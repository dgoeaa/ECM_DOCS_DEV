// NITDA AckFlow - Core System Configuration
window.NITDA_CONFIG = {
  // Microsoft Power Automate HTTP trigger endpoints
  API_GET: "https://defaultca6a4b3f912349bcbcb927085ebbf1.a1.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=DIStZ3aNpg87fB57xWi95xf6-10ON9xdKj8gtu6DXAU",
  API_CREATE: "https://YOUR_FLOW_URL/create",   // Replace with your Live Flow 2 URL when ready
  API_ACK: "https://YOUR_FLOW_URL/acknowledge",  // Replace with your Live Flow 3 URL when ready

  // Fallback Engine Configuration (Prevents system failure if endpoints are default placeholders)
  fallbackEngine: {
    enabled: true,
    storageKey: "nitda_ackflow_local_db"
  }
};

// Global Storage Controller to synchronize state between Dashboard, Email, and Ack pages
const AckFlowStore = {
  init() {
    if (!localStorage.getItem(window.NITDA_CONFIG.fallbackEngine.storageKey)) {
      const defaultTasks = [
        { id: "NITDA-REG-0481", title: "Request for .gov.ng Domain Clearance — Ministry of Health", status: "Pending", created: new Date(Date.now() - 14400000).toISOString(), device: "" },
        { id: "NITDA-PRJ-2207", title: "IT Project Clearance — National Identity Database Upgrade", status: "Pending", created: new Date(Date.now() - 86400000).toISOString(), device: "" },
        { id: "NITDA-OEM-1190", title: "OEM Certification Renewal — Zinox Technologies Ltd", status: "Acknowledged", created: new Date(Date.now() - 172800000).toISOString(), device: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      ];
      localStorage.setItem(window.NITDA_CONFIG.fallbackEngine.storageKey, JSON.stringify(defaultTasks));
    }
  },
  getTasks() {
    this.init();
    return JSON.parse(localStorage.getItem(window.NITDA_CONFIG.fallbackEngine.storageKey));
  },
  getTask(id) {
    const tasks = this.getTasks();
    return tasks.find(t => t.id === id);
  },
  saveTask(task) {
    const tasks = this.getTasks();
    tasks.unshift(task);
    localStorage.setItem(window.NITDA_CONFIG.fallbackEngine.storageKey, JSON.stringify(tasks));
  },
  acknowledgeTask(id, device) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index].status = "Acknowledged";
      tasks[index].device = device;
      tasks[index].acknowledgedAt = new Date().toISOString();
      localStorage.setItem(window.NITDA_CONFIG.fallbackEngine.storageKey, JSON.stringify(tasks));
      return true;
    }
    return false;
  }
};