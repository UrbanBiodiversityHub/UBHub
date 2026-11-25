import { describe, it, expect } from 'vitest'
import { resolvePrivilegeUpdate } from '../services/userRoleService.js'

const executive = { sessionPrivileges: 4, sessionEmail: 'exec@example.org' }

describe('resolvePrivilegeUpdate', () => {
  it('returns the integer level when an executive changes another user', () => {
    expect(resolvePrivilegeUpdate({ ...executive, requestedPrivileges: '2', targetEmail: 'someone@example.org' })).toBe(2)
    expect(resolvePrivilegeUpdate({ ...executive, requestedPrivileges: 0, targetEmail: 'someone@example.org' })).toBe(0)
  })

  it('rejects non-executives', () => {
    expect(() => resolvePrivilegeUpdate({ sessionPrivileges: 3, sessionEmail: 'a@example.org', requestedPrivileges: 2, targetEmail: 'b@example.org' }))
      .toThrow(expect.objectContaining({ code: 'ROLE_CHANGE_FORBIDDEN' }))
  })

  it.each(['', '5', '-1', '2.5', 'admin', null])('rejects unknown level %s', (requestedPrivileges) => {
    expect(() => resolvePrivilegeUpdate({ ...executive, requestedPrivileges, targetEmail: 'b@example.org' }))
      .toThrow(expect.objectContaining({ code: 'INVALID_PRIVILEGE_LEVEL' }))
  })

  it('rejects an executive changing their own role, case-insensitively', () => {
    expect(() => resolvePrivilegeUpdate({ ...executive, requestedPrivileges: 1, targetEmail: 'EXEC@example.org ' }))
      .toThrow(expect.objectContaining({ code: 'CANNOT_CHANGE_OWN_ROLE' }))
  })

  it('allows an executive to resubmit their own unchanged role', () => {
    expect(resolvePrivilegeUpdate({ ...executive, requestedPrivileges: '4', targetEmail: 'exec@example.org' })).toBe(4)
  })
})
