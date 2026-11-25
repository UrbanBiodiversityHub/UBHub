/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import pug from 'pug'
import {
  getTablesForUser,
  getEditableColumnsForUser,
  getNavigationMenuForUser,
  PRIVILEGE_LEVEL_DEFINITIONS,
} from '../services/tableMetadata.js'
import { TableManager } from '../public/javascripts/data-management/tableManager.js'
import { ModalManager } from '../public/javascripts/data-management/modalManager.js'

function sessionRequest(privileges) {
  return { session: { user: 'staff', email: 'staff@example.org', privileges } }
}

// Renders the real dataManagement.pug page so duplicate ids between the edit
// modal and the My Profile modal would show up here.
function setUpPage(request) {
  const config = {
    tablesForUser: getTablesForUser(request),
    editableColumns: getEditableColumnsForUser(request),
    navMenu: getNavigationMenuForUser(request),
    user: null,
  }
  const html = pug.renderFile(path.join(__dirname, '..', 'views', 'dataManagement.pug'), {
    dataManagementConfig: JSON.stringify(config),
    user: 'staff',
    privilegeLevels: PRIVILEGE_LEVEL_DEFINITIONS,
  })
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, 'text/html').documentElement.innerHTML
  const tableManager = new TableManager({ tables: config.tablesForUser, editableColumns: config.editableColumns, navMenu: config.navMenu })
  tableManager.selectedTable = 'users'
  tableManager.fetchTableData = vi.fn().mockResolvedValue([])
  tableManager.applyFiltersAndSort = vi.fn()
  const apiClient = { post: vi.fn().mockResolvedValue({}) }
  const modalManager = new ModalManager(tableManager, { apiClient })
  return { tableManager, modalManager, apiClient }
}

function readFormValues() {
  const values = {}
  document.getElementById('modalForm').querySelectorAll('[data-col-name]').forEach(element => {
    values[element.getAttribute('data-col-name')] = element.value
  })
  return values
}

const userRow = {
  alias: 'Ada Lovelace', email: 'ada@example.org', privileges: 2, region: 'EU', phone: null,
  institution: 'Analytical Society', city: 'London', country: 'UK', title: 'Countess', level: 'Senior', workingGroup: 'Math',
}

describe('Manage Users edit modal', () => {
  let page

  beforeEach(() => { page = setUpPage(sessionRequest(4)) })

  it('pre-fills the edit form with the row values and an edit title', async () => {
    await page.tableManager.actionHandlerMap.openEditUserModal(userRow)
    const values = readFormValues()
    expect(values.alias).toBe('Ada Lovelace')
    expect(values.institution).toBe('Analytical Society')
    expect(values.phone).toBe('')
    expect(document.getElementById('modalTitle').textContent).toBe('Edit Entry in Users')
  })

  it('shows a Role dropdown with every role, pre-selected to the user\'s role', async () => {
    await page.tableManager.actionHandlerMap.openEditUserModal(userRow)
    const roleSelect = document.querySelector('#modalForm select[data-col-name="privileges"]')
    expect(roleSelect).toBeTruthy()
    expect(Array.from(roleSelect.options).map(option => option.textContent))
      .toEqual(['Contact', 'User', 'Contributor', 'Approver', 'Executive'])
    expect(roleSelect.value).toBe('2')
  })

  it('submits the chosen role to the contact update endpoint', async () => {
    await page.tableManager.actionHandlerMap.openEditUserModal(userRow)
    document.querySelector('#modalForm select[data-col-name="privileges"]').value = '3'
    await page.modalManager._onSubmit(new Event('submit'))
    expect(page.apiClient.post).toHaveBeenCalledWith('/dataManagement/contact/update', expect.objectContaining({
      rowKey: { email: 'ada@example.org' },
      data: expect.objectContaining({ privileges: '3', alias: 'Ada Lovelace' }),
    }))
  })

  it('does not show the Role dropdown when creating a contact', async () => {
    await page.modalManager.open('add', 'users')
    expect(document.querySelector('#modalForm [data-col-name="privileges"]')).toBeNull()
    expect(document.querySelector('#modalForm [data-col-name="alias"]')).toBeTruthy()
  })

  it('does not reuse the My Profile form ids', async () => {
    await page.tableManager.actionHandlerMap.openEditUserModal(userRow)
    for (const id of ['alias', 'title', 'institution']) {
      expect(document.querySelectorAll(`[id="${id}"]`).length).toBe(1)
    }
  })

  it('labels the email-list Role filter with the correct roles', () => {
    const optionTexts = Array.from(document.getElementById('emailListPrivileges').options)
      .map(option => `${option.value}=${option.textContent}`)
    expect(optionTexts).toEqual(['=Any role', '0=Contact', '1=User', '2=Contributor', '3=Approver', '4=Executive'])
  })
})

describe('Users edit modal for approvers', () => {
  it('has no Role dropdown', async () => {
    const page = setUpPage(sessionRequest(3))
    await page.modalManager.open('edit', 'users', userRow)
    expect(document.querySelector('#modalForm [data-col-name="privileges"]')).toBeNull()
  })
})
