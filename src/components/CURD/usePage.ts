import { ref } from "vue";
import type { IObject, PageContentInstance, PageModalInstance, PageSearchInstance } from "./types";

function usePage() {
  const searchRef = ref<PageSearchInstance>();
  const contentRef = ref<PageContentInstance>();
  const addModalRef = ref<PageModalInstance>();
  const editModalRef = ref<PageModalInstance>();

  // 搜索
  function handleQueryClick(queryParams: IObject) {
    const filterParams = contentRef.value?.getFilterParams();
    contentRef.value?.fetchPageData({ ...queryParams, ...filterParams }, true);
  }
  // 重置
  function handleResetClick(queryParams: IObject) {
    const filterParams = contentRef.value?.getFilterParams();
    contentRef.value?.fetchPageData({ ...queryParams, ...filterParams }, true);
  }
  // 新增
  function handleAddClick() {
    //显示添加表单
    addModalRef.value?.setModalVisible();
  }
  // 编辑
  async function handleEditClick(row: IObject, callback?: (result?: IObject) => IObject) {
    editModalRef.value?.setModalVisible();
    editModalRef.value?.handleDisabled(false);
    let from = await (callback?.(row) ?? Promise.resolve(row));
    editModalRef.value?.setFormData(from ? from : row);
  }
  // 编辑
  async function handleViewClick(row: IObject, callback?: (result?: IObject) => IObject) {
    editModalRef.value?.setModalVisible();
    editModalRef.value?.handleDisabled(true);
    let from = await (callback?.(row) ?? Promise.resolve(row));
    editModalRef.value?.setFormData(from ? from : row);
  }
  // 表单提交
  function handleSubmitClick() {
    //根据检索条件刷新列表数据
    const queryParams = searchRef.value?.getQueryParams();
    contentRef.value?.fetchPageData(queryParams, true);
  }
  // 导出
  function handleExportClick() {
    // 根据检索条件导出数据
    const queryParams = searchRef.value?.getQueryParams();
    contentRef.value?.exportPageData(queryParams);
  }
  // 搜索显隐
  function handleSearchClick() {
    searchRef.value?.toggleVisible();
  }
  // 涮选数据
  function handleFilterChange(filterParams: IObject) {
    const queryParams = searchRef.value?.getQueryParams();
    contentRef.value?.fetchPageData({ ...queryParams, ...filterParams }, true);
  }

  return {
    searchRef,
    contentRef,
    addModalRef,
    editModalRef,
    handleQueryClick,
    handleResetClick,
    handleAddClick,
    handleEditClick,
    handleViewClick,
    handleSubmitClick,
    handleExportClick,
    handleSearchClick,
    handleFilterChange,
  };
}

export default usePage;
