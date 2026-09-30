export type EmailJobData = {
  email: string;
  otp: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
};

export type PushNotificationJobData = {
  notificationId: string;
  userId: string;
  eventType: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};
