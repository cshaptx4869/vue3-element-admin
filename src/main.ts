import {createApp} from 'vue'
import App from './App.vue'
import router from "./router";
import '@/styles/index.scss'
import { store } from "./store";
import ElementPlus from 'element-plus'
import 'element-plus/theme-chalk/index.css'
import locale from 'element-plus/lib/locale/lang/zh-cn'
import 'virtual:svg-icons-register';


// @see https://blog.csdn.net/qq_37213281/article/details/121422027
import * as ElIconModules from '@element-plus/icons'
import '@/permission'


import Pagination from '@/components/Pagination/index.vue'
import {listDictsByCode} from '@/api/system/dict'


const app = createApp(App)

// 统一注册el-icon图标
// @link https://blog.csdn.net/Alloom/article/details/119415984
for (let iconName in ElIconModules) {
    app.component(iconName, (ElIconModules as any)[iconName])
}

// 全局方法
app.config.globalProperties.$listDictsByCode = listDictsByCode
app.component('Pagination', Pagination) // 全局组件
     .use(store)
    .use(router)
    .use(ElementPlus, {locale})
    .mount('#app')
