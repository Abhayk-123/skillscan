
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getMe: () => request("/auth/me"),
  signup: (payload) => request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  requestPasswordReset: (payload) => request("/auth/request-password-reset", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  pricing: () => request("/pricing"),
  analyze: (formData) => request("/analyze", { method: "POST", body: formData }),
  matchJob: (payload) => request("/match-job", { method: "POST", body: JSON.stringify(payload) }),
  rewriteResume: (payload) => request("/rewrite", { method: "POST", body: JSON.stringify(payload) }),
  history: () => request("/history"),
  dashboardAnalytics: () => request("/dashboard-analytics"),
  getProfile: () => request("/profile"),
  saveProfile: (payload) => request("/profile", { method: "POST", body: JSON.stringify(payload) }),
  savedJds: () => request("/saved-jds"),
  saveJd: (payload) => request("/saved-jds", { method: "POST", body: JSON.stringify(payload) }),
  coverLetter: (payload) => request("/cover-letter", { method: "POST", body: JSON.stringify(payload) }),
  interviewQuestions: (payload) => request("/interview-questions", { method: "POST", body: JSON.stringify(payload) }),
  exportAnalysisUrl: (id) => `${API_BASE_URL}/export-analysis/${id}`,
  createOrder: () => request("/payments/create-order", { method: "POST" }),
  verifyPayment: (payload) => request("/payments/verify", { method: "POST", body: JSON.stringify(payload) }),
  subscriptionPlans: () => request("/subscriptions/plans"),
  createSubscription: (payload) => request("/subscriptions/create", { method: "POST", body: JSON.stringify(payload) }),
  currentSubscription: () => request("/subscriptions/current"),
  cancelSubscription: () => request("/subscriptions/cancel", { method: "POST" }),
  adminOverview: () => request("/admin/overview"),
  adminListRazorpayPlans: () => request("/admin/razorpay-plans"),
  adminCreateRazorpayPlan: (payload) => request("/admin/razorpay-plans", { method: "POST", body: JSON.stringify(payload) }),
  adminActivateRazorpayPlan: (id) => request(`/admin/razorpay-plans/${id}/activate`, { method: "POST" }),
  adminDeactivateRazorpayPlan: (id) => request(`/admin/razorpay-plans/${id}/deactivate`, { method: "POST" }),
  submitFeedback: (payload) => request("/feedback", { method: "POST", body: JSON.stringify(payload) }),
  adminFeedback: () => request("/admin/feedback"),
  adminFeedbackAnalytics: () => request("/admin/feedback-analytics"),
  startMockInterview: (payload) => request("/mock-interview/start", { method: "POST", body: JSON.stringify(payload) }),
  evaluateMockAnswer: (payload) => request("/mock-interview/evaluate", { method: "POST", body: JSON.stringify(payload) }),
  dsaStatus: () => request("/dsa/status"),
  submitDsa: (payload) => request("/dsa/submit", { method: "POST", body: JSON.stringify(payload) }),
};
