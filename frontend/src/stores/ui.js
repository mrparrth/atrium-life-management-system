import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import { useSettingsStore } from "./settings";

export const useUIStore = defineStore("ui", () => {
  const settings = useSettingsStore();

  const theme = computed({
    get: () => settings.get("theme", localStorage.getItem("atrium.theme") || "light"),
    set: (val) => settings.set("theme", val)
  });

  const mode = computed({
    get: () => settings.get("mode", localStorage.getItem("atrium.mode") || "personal"),
    set: (val) => settings.set("mode", val)
  });

  const showWorkspaceAlerts = computed({
    get: () => settings.get("show_workspace_alerts", localStorage.getItem("atrium.show_workspace_alerts") !== "false"),
    set: (val) => settings.set("show_workspace_alerts", val)
  });

  const userName = computed({
    get: () => settings.get("user_name", localStorage.getItem("atrium.user_name") || ""),
    set: (val) => settings.set("user_name", val.trim())
  });

  const sidebarOpen = ref(true);
  const commandOpen = ref(false);
  const quickCaptureOpen = ref(false);
  const taskEditOpen = ref(false);
  const taskToEdit = ref(null);
  const toasts = ref([]);
  const confirmState = ref(null);

  function applyTheme() {
    const root = document.documentElement;
    if (theme.value === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }
  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  function toggleMode() {
    theme.value; // access reactive source
    mode.value = mode.value === "work" ? "personal" : "work";
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
