/**
 * Rules for changing a user's role (users.privileges) from the Manage Users UI.
 *
 * Pure policy: no database access. Routes call this before writing the update
 * and map the typed error codes to 4xx responses.
 */

import { coerceToInteger } from '../utils/validationUtils.js';
import { PRIVILEGE_LEVEL_DEFINITIONS } from './tableMetadata.js';

const EXECUTIVE_PRIVILEGE_LEVEL = 4;

function createRoleError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Validate a requested role change and return the privilege level to store.
 *
 * @param {object} parameters
 * @param {*} parameters.requestedPrivileges - raw value from the request body.
 * @param {number} parameters.sessionPrivileges - privileges of the person making the change.
 * @param {string} parameters.sessionEmail - email of the person making the change.
 * @param {string} parameters.targetEmail - email of the user being edited.
 * @returns {number} the validated privilege level.
 * @throws {Error} code ROLE_CHANGE_FORBIDDEN when the requester is not an Executive,
 *   INVALID_PRIVILEGE_LEVEL when the value is not a known level, or
 *   CANNOT_CHANGE_OWN_ROLE when an Executive tries to change their own role.
 */
export function resolvePrivilegeUpdate({ requestedPrivileges, sessionPrivileges, sessionEmail, targetEmail }) {
  if (Number(sessionPrivileges) < EXECUTIVE_PRIVILEGE_LEVEL) {
    throw createRoleError('Only executives can change a user\'s role', 'ROLE_CHANGE_FORBIDDEN');
  }

  const privilegeLevel = coerceToInteger(requestedPrivileges);
  const isKnownLevel = PRIVILEGE_LEVEL_DEFINITIONS.some(definition => definition.value === privilegeLevel);
  if (privilegeLevel === null || !isKnownLevel) {
    throw createRoleError('Invalid role', 'INVALID_PRIVILEGE_LEVEL');
  }

  const normalizedSessionEmail = String(sessionEmail || '').trim().toLowerCase();
  const normalizedTargetEmail = String(targetEmail || '').trim().toLowerCase();
  const isOwnAccount = normalizedSessionEmail !== '' && normalizedSessionEmail === normalizedTargetEmail;
  if (isOwnAccount && privilegeLevel !== Number(sessionPrivileges)) {
    // Prevents an executive from accidentally locking themselves out.
    throw createRoleError('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
  }

  return privilegeLevel;
}
