-- OTP state is now held exclusively in Redis with a short TTL.
DROP TABLE IF EXISTS "OtpChallenge";
DROP TYPE IF EXISTS "OtpPurpose";
