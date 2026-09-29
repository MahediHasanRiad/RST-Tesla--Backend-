export type SafeUserProfile = {
  id: string;
  role: "PASSENGER" | "DRIVER" | "ADMIN";
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};
