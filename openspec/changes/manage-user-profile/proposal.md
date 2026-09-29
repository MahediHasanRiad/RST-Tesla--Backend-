# Proposal

## Why

Authenticated passengers and drivers need to keep their account information current and need a way to permanently remove an account they no longer wish to use. The API currently has no self-service profile-management endpoints.

## What Changes

- Add authenticated endpoints for an account holder to view and update their own profile information.
- Permit updates only to supported profile fields, validating each field and enforcing email and phone uniqueness.
- Add an authenticated self-service endpoint that permanently deletes the caller's account and its dependent authentication/profile records.
- Reject deletion while the account has an active ride or pool responsibility, so the deletion cannot violate ride lifecycle, membership, or capacity records.
- Revoke active sessions and remove externally stored avatar media when an account is permanently deleted.

## Capabilities

### New Capabilities

- `user-profile-management`: Authenticated account owners can retrieve and update their own profile, and permanently delete their account when doing so is safe.

### Modified Capabilities

- None.

## Impact

- Affected API: new protected `/api/v1` profile/account routes and response contracts.
- Affected application layers: authentication middleware integration; user validation, controller, service, repository, and focused tests.
- Affected persistence and media: user, role-profile, and refresh-session data; Cloudinary avatar cleanup; deletion safeguards that consult ride and pool state.
- The new capability assumes the in-progress `add-user-auth` change provides authenticated actor context and session storage.
