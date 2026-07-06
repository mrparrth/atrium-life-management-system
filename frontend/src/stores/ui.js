import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { db } from "@/db";

export const useUIStore = defineStore("ui", () => {
  const theme = ref(localStorage.getItem("atrium.theme") || "light");
  const mode = ref(localStorage.getItem("atrium.mode") || "personal");
  const sidebarOpen = ref(true);
  const commandOpen = ref(false);
  const quickCaptureOpen = ref(false);
  const taskEditOpen = ref(false);
  const taskToEdit = ref(null);
  const toasts = ref([]);
  const confirmState = ref(null);
  const showWorkspaceAlerts = ref(localStorage.getItem("atrium.show_workspace_alerts") !== "false");
  const userName = ref(localStorage.getItem("atrium.user_name") || "");

  function applyTheme() {
    const root = document.documentElement;
    if (theme.value === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("atrium.theme", theme.value);
  }
  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  function toggleMode() {
    mode.value = mode.value === "work" ? "personal" : "work";
    localStorage.setItem("atrium.mode", mode.value);
    showToast(`Switched to ${mode.value === "work" ? "Work" : "Personal"} Mode`, "success");
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
    const id = Date.now() + Math.random().toString(36).slice(2);
    toasts.value.push({ id, msg, type });
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }
  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
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
  watch(showWorkspaceAlerts, (val) => {
    localStorage.setItem("atrium.show_workspace_alerts", val ? "true" : "false");
  });
  watch(userName, (val) => {
    localStorage.setItem("atrium.user_name", val.trim());
  });

  return {
    theme,
    mode,
    sidebarOpen,
    commandOpen,
    quickCaptureOpen,
    taskEditOpen,
    taskToEdit,
    toasts,
    confirmState,
    showWorkspaceAlerts,
    userName,
    toggleTheme,
    toggleMode,
    openCommand,
    closeCommand,
    openQuickCapture,
    closeQuickCapture,
    openTaskEdit,
    closeTaskEdit,
    showToast,
    removeToast,
    confirm,
  };
});
