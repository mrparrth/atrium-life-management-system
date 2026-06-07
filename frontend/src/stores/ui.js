import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { db } from "@/db";

export const useUIStore = defineStore("ui", () => {
  const theme = ref(localStorage.getItem("atrium.theme") || "light");
  const sidebarOpen = ref(true);
  const commandOpen = ref(false);
  const quickCaptureOpen = ref(false);
  const taskEditOpen = ref(false);
  const taskToEdit = ref(null);
  const toast = ref(null);
  const confirmState = ref(null);

  function applyTheme() {
    const root = document.documentElement;
    if (theme.value === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("atrium.theme", theme.value);
  }
  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  function openCommand() {
    commandOpen.value = true;
  }
  function closeCommand() {
    commandOpen.value = false;
  }
  function openQuickCapture() {
    quickCaptureOpen.value = true;
  }
  function closeQuickCapture() {
    quickCaptureOpen.value = false;
  }
  function openTaskEdit(task) {
    taskToEdit.value = task;
    taskEditOpen.value = true;
  }
  function closeTaskEdit() {
    taskEditOpen.value = false;
    taskToEdit.value = null;
  }
  function showToast(msg, type = "info") {
    toast.value = { msg, type, id: Date.now() };
    setTimeout(() => {
      if (toast.value && toast.value.msg === msg) toast.value = null;
    }, 2400);
  }
  function confirm(options) {
    return new Promise((resolve) => {
      let opts = {};
      if (typeof options === "string") {
        opts = { message: options };
      } else {
        opts = options || {};
      }
      confirmState.value = {
        title: opts.title || "Confirm Action",
        message: opts.message || "Are you sure you want to proceed?",
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        isDestructive: opts.isDestructive !== false,
        resolve: (val) => {
          confirmState.value = null;
          resolve(val);
        },
      };
    });
  }

  watch(theme, applyTheme, { immediate: true });

  return {
    theme,
    sidebarOpen,
    commandOpen,
    quickCaptureOpen,
    taskEditOpen,
    taskToEdit,
    toast,
    confirmState,
    toggleTheme,
    openCommand,
    closeCommand,
    openQuickCapture,
    closeQuickCapture,
    openTaskEdit,
    closeTaskEdit,
    showToast,
    confirm,
  };
});
