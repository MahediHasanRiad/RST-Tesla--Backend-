# Spec Delta

## Purpose

Allows authenticated account holders to safely manage their own profile data and permanently remove an unused account.

## ADDED Requirements

### Requirement: Account owner can retrieve and update their profile
The system SHALL provide authenticated account owners an endpoint to retrieve their own profile and an endpoint to update their own name, phone number, and avatar. The system MUST derive the target account exclusively from the authenticated actor, reject unknown or malformed input, preserve the account's role and authentication state, and reject a requested phone number that belongs to another account. Profile responses MUST NOT include password hashes, tokens, or other authentication secrets.

#### Scenario: Account owner retrieves their profile
- **WHEN** an authenticated account owner requests their profile
- **THEN** the system returns that owner's permitted profile data with a 200 response

#### Scenario: Account owner updates permitted profile fields
- **WHEN** an authenticated account owner supplies valid name, unused phone number, or avatar updates
- **THEN** the system persists the requested changes and returns the updated permitted profile data with a 200 response

#### Scenario: Duplicate phone number is rejected
- **WHEN** an authenticated account owner requests a phone number held by another account
- **THEN** the system returns a 409 response and leaves the profile unchanged

#### Scenario: Caller cannot select another account
- **WHEN** a profile request includes an account identifier that differs from the authenticated actor
- **THEN** the system does not treat that identifier as proof of identity and returns or modifies only the authenticated actor's profile

### Requirement: Account owner can permanently delete an inactive account
The system SHALL allow an authenticated account owner to permanently delete their own account only when they have no active ride or pool responsibility. The deletion MUST remove the account's dependent authentication and role-profile data, revoke or remove all refresh sessions, and remove the account avatar from external storage when one exists. The system MUST retain completed and cancelled ride, fare, and lifecycle records without personal account data or a live account reference.

#### Scenario: Inactive account is permanently deleted
- **WHEN** an authenticated account owner with no active ride or pool responsibility requests account deletion
- **THEN** the system permanently deletes the account and its dependent authentication and profile data, removes its avatar media when present, and returns a 204 response

#### Scenario: Active rider or driver cannot delete account
- **WHEN** an authenticated account owner has an active ride, is assigned to an active pool, or has another active pool responsibility
- **THEN** the system returns a 409 response and leaves the account and related data intact

#### Scenario: Unauthenticated deletion is denied
- **WHEN** a client requests account deletion without a valid authenticated actor
- **THEN** the system returns a 401 response and does not delete any account
