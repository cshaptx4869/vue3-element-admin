import vue from "@vitejs/plugin-vue";
import type { PluginOption } from "vite";
import { type ConfigEnv, type UserConfig, loadEnv, defineConfig } from "vite";

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import type { ComponentInfo, ComponentResolverObject } from "unplugin-vue-components";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

import { mockDevServerPlugin } from "vite-plugin-mock-dev-server";

import UnoCSS from "unocss/vite";
import { resolve } from "path";
import fs from "node:fs";
import { name, version } from "./package.json" with { type: "json" };

// 平台名称、版本信息
const __APP_INFO__ = {
  pkg: { name, version },
  buildTimestamp: Date.now(),
};

// ESM 模式下使用 import.meta.dirname（Node 20.11+）
const pathSrc = resolve(import.meta.dirname, "src");

// Element Plus 按需样式解析器（与下方 AutoImport/Components 同配置，保证解析结果一致）
const [elementPlusComponentResolver, elementPlusDirectiveResolver] = ElementPlusResolver({
  importStyle: "sass",
}) as [ComponentResolverObject, ComponentResolverObject];

/** kebab-case 组件名转 El 前缀 PascalCase：el-button-group → ElButtonGroup */
function toElementPlusName(kebabName: string): string {
  return `El${kebabName
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
}

/** 收集 resolver 解析出的样式副作用路径（sideEffects 支持 string / ImportInfo / 数组） */
function collectSideEffects(resolved: ComponentInfo | string, styleImports: Set<string>): void {
  if (typeof resolved === "string") return; // Element Plus 返回 ComponentInfo，字符串路径防御性跳过
  const { sideEffects } = resolved;
  if (!sideEffects) return;
  if (Array.isArray(sideEffects)) {
    for (const effect of sideEffects) {
      styleImports.add(typeof effect === "string" ? effect : effect.from);
    }
  } else {
    styleImports.add(typeof sideEffects === "string" ? sideEffects : sideEffects.from);
  }
}

// 扫描 src 实际用到的 Element Plus 组件/指令，经 resolver 解析出样式预构建清单。
// 与硬编码清单作用等价（首启预构建、避免首次使用时页面刷新），但随源码用法自动增删。
async function collectElementPlusStyleImports(): Promise<string[]> {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(resolve(dir, entry.name));
      } else if (/\.(vue|ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(resolve(dir, entry.name));
      }
    }
  };
  walk(pathSrc);

  const componentNames = new Set<string>();
  const directiveNames = new Set<string>();

  for (const file of files) {
    const source = fs.readFileSync(file, "utf-8");

    // <el-button> / <el-form-item> 等 kebab-case 标签
    for (const match of source.matchAll(/<el-([a-z0-9][a-z0-9-]*)/g)) {
      componentNames.add(toElementPlusName(match[1]));
    }
    // <ElTable> / <ElButton> 等 PascalCase 标签
    for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
      if (match[1].startsWith("El")) componentNames.add(match[1]);
    }
    // ElMessage / ElMessageBox / ElLoading 等脚本标识符
    for (const match of source.matchAll(/\bEl[A-Z][A-Za-z0-9]*\b/g)) {
      componentNames.add(match[0]);
    }
    // v-loading / v-popover / v-infinite-scroll 指令
    for (const match of source.matchAll(/\bv-(loading|popover|infinite-scroll)\b/g)) {
      directiveNames.add(
        match[1]
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("")
      );
    }
  }

  const styleImports = new Set<string>();
  for (const name of componentNames) {
    const resolved = await elementPlusComponentResolver.resolve(name);
    if (resolved) collectSideEffects(resolved, styleImports);
  }
  for (const name of directiveNames) {
    const resolved = await elementPlusDirectiveResolver.resolve(name);
    if (resolved) collectSideEffects(resolved, styleImports);
  }
  return [...styleImports];
}

// Vite配置  https://cn.vitejs.dev/config
export default defineConfig(async ({ mode }: ConfigEnv): Promise<UserConfig> => {
  const env = loadEnv(mode, process.cwd());
  // 生成 Element Plus 组件样式预构建清单（resolver 驱动）
  const elementPlusStyleImports = await collectElementPlusStyleImports();

  return {
    resolve: {
      alias: {
        "@": pathSrc,
      },
    },
    css: {
      preprocessorOptions: {
        // 注入项目布局变量。
        scss: {
          additionalData: `@use "@/styles/variables.scss" as *;`,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: +env.VITE_APP_PORT,
      open: true,
      proxy: {
        [env.VITE_APP_BASE_API]: {
          changeOrigin: true,
          target: env.VITE_APP_API_URL,
          rewrite: (path: string) => path.replace(new RegExp(`^${env.VITE_APP_BASE_API}`), ""),
        },
      },
    },
    plugins: [
      vue(),
      ...(env.VITE_MOCK_DEV_SERVER === "true" ? [mockDevServerPlugin()] : []),
      UnoCSS(),
      // API 自动导入
      AutoImport({
        // 导入 Vue 函数，如：ref, reactive, toRef 等
        imports: ["vue", "@vueuse/core", "pinia", "vue-router", "vue-i18n"],
        resolvers: [
          // 导入 Element Plus函数，如：ElMessage, ElMessageBox 等
          ElementPlusResolver({ importStyle: "sass" }),
        ],
        eslintrc: {
          enabled: false,
          filepath: "./.eslintrc-auto-import.json",
          globalsPropValue: true,
        },
        vueTemplate: true,
        // 导入函数类型声明文件路径 (false:关闭自动生成)
        dts: false,
        // dts: "types/auto-imports.d.ts",
      }),
      // 组件自动导入
      Components({
        resolvers: [
          // 导入 Element Plus 组件
          ElementPlusResolver({ importStyle: "sass" }),
        ],
        // 指定自定义组件位置(默认:src/components)
        dirs: ["src/components", "src/**/components"],
        // 导入组件类型声明文件路径 (false:关闭自动生成)
        dts: false,
        //dts: "types/components.d.ts",
      }),
    ] as PluginOption[],
    // 预加载项目必需的依赖
    optimizeDeps: {
      include: [
        "vue",
        "vue-router",
        "element-plus",
        "pinia",
        "axios",
        "@vueuse/core",
        "codemirror-editor-vue3",
        "exceljs",
        "path-to-regexp",
        "echarts/core",
        "echarts/renderers",
        "echarts/charts",
        "echarts/components",
        "vue-i18n",
        "nprogress",
        "sortablejs",
        "qs",
        "vxe-table",
        "path-browserify",
        "lodash-es",
        "@element-plus/icons-vue",
        "element-plus/es",
        "element-plus/es/locale/lang/en",
        "element-plus/es/locale/lang/zh-cn",
        // Element Plus 组件样式预构建（resolver 驱动）：扫描 src 实际用到的组件/指令，
        // 解析出 base + 组件样式路径，首启即预加载，避免首次使用某组件时重优化导致页面刷新
        ...elementPlusStyleImports,
      ],
    },
    // 构建配置（Vite 8 使用 Rolldown + Oxc）
    build: {
      chunkSizeWarningLimit: 1200, // chunk 大小警告阈值
      reportCompressedSize: false,
      cssMinify: "lightningcss", // Vite 8 默认使用 Lightning CSS 压缩
      // minify 默认使用 'oxc'，压缩速度比 terser 快 30-90 倍
      rolldownOptions: {
        checks: {
          pluginTimings: false,
        },
        output: {
          // 用于从入口点创建的块的打包输出格式
          entryFileNames: "js/[name].[hash].js",
          // 用于命名代码拆分时创建的共享块的输出命名
          chunkFileNames: "js/[name].[hash].js",
          // 用于输出静态资源的命名
          assetFileNames: (assetInfo) => {
            const assetName = assetInfo.names[0];

            if (!assetName) {
              return "assets/[name].[hash][extname]";
            }

            const info = assetName.split(".");
            let extType = info[info.length - 1];
            if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetName)) {
              extType = "media";
            } else if (/\.(png|jpe?g|gif|svg)(\?.*)?$/.test(assetName)) {
              extType = "img";
            } else if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetName)) {
              extType = "fonts";
            }
            return `${extType}/[name].[hash].[ext]`;
          },
        },
      },
    },
    define: {
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
  };
});
