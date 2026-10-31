import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, isMobile, login, logout, submitLogin, toast } from './support/auth'

/** Collector profile (README: edit data, avatar and password, with validation and API errors). */

const form = (page: Page) => page.getByTestId('profile-form')
const passwordForm = (page: Page) => page.getByTestId('password-form')
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

async function openProfile(page: Page, user: { email: string; password: string } = ANA) {
  await login(page, user, '/login?redirect=%2Fprofile')
  await expect(form(page)).toBeVisible()
}

test.describe('Perfil do colecionador', () => {
  test('edita dados, persiste após refresh e atualiza o header', async ({ page }) => {
    await openProfile(page)
    await form(page).getByLabel('Nome de exibição').fill('Ana Kurio')
    await form(page).getByLabel('Nome de usuário').fill('ana.colecao')
    await form(page).getByLabel('E-mail').fill('ana.nova@kurio.test')
    const patch = page.waitForResponse((r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname === '/api/profile')
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    expect((await patch).fromServiceWorker()).toBe(true)
    await expect(toast(page, 'Perfil atualizado.')).toBeVisible()
    await expect(page.getByTestId('profile-details')).toContainText('@ana.colecao')
    if (!isMobile(page)) await expect(page.getByTestId('account-link')).toContainText('Ana')

    await page.reload()
    await expect(page.getByTestId('profile-details')).toContainText('Ana Kurio')
    await expect(page.getByTestId('profile-details')).toContainText('ana.nova@kurio.test')
    await expect(form(page).getByLabel('Nome de usuário')).toHaveValue('ana.colecao')
  })

  test('valida os campos e mostra os conflitos da API', async ({ page }) => {
    await openProfile(page)
    const name = form(page).getByLabel('Nome de exibição')
    await name.fill('')
    await form(page).getByLabel('E-mail').fill('ana@')
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    await expect(name).toHaveAccessibleDescription('Informe o nome de exibição.')
    await expect(form(page).getByLabel('E-mail')).toHaveAccessibleDescription('Informe um e-mail válido.')
    await expect(name).toBeFocused()

    await name.fill('Ana')
    await form(page).getByLabel('E-mail').fill(BRUNO.email)
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    await expect(form(page).getByLabel('E-mail')).toHaveAccessibleDescription('Este e-mail já está cadastrado.')

    await form(page).getByLabel('E-mail').fill(ANA.email)
    await form(page).getByLabel('Nome de usuário').fill(BRUNO.username)
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    await expect(form(page).getByLabel('Nome de usuário')).toHaveAccessibleDescription('Este nome de usuário já está em uso.')
  })

  test('avatar: troca, persiste, recusa arquivo inválido e remove', async ({ page }) => {
    await openProfile(page)
    const input = page.getByTestId('avatar-input')
    await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(form(page).getByRole('alert')).toHaveText('Use uma imagem PNG, JPEG ou WebP.')

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1X1 })
    await expect(form(page).getByRole('img', { name: 'Prévia do avatar' })).toBeVisible()
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    await expect(toast(page, 'Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('profile-avatar')).toHaveAttribute('src', /^data:image\/png;base64,/)

    await form(page).getByRole('button', { name: 'Remover' }).click()
    await form(page).getByRole('button', { name: 'Salvar' }).click()
    await expect(toast(page, 'Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('profile-avatar')).toHaveCount(0)
  })

  test('alteração de senha: validação, senha atual incorreta e login com a nova', async ({ page }) => {
    await openProfile(page, BRUNO)
    const current = passwordForm(page).getByLabel('Senha atual', { exact: true })
    const next = passwordForm(page).getByLabel('Nova senha', { exact: true })
    const confirmation = passwordForm(page).getByLabel('Confirmar nova senha', { exact: true })

    await next.fill('NovaSenha9')
    await confirmation.fill('Diferente9')
    await passwordForm(page).getByRole('button', { name: 'Alterar senha' }).click()
    await expect(current).toHaveAccessibleDescription('Informe a senha atual.')
    await expect(confirmation).toHaveAccessibleDescription('As senhas não coincidem.')

    await current.fill('Errada123')
    await confirmation.fill('NovaSenha9')
    await passwordForm(page).getByRole('button', { name: 'Alterar senha' }).click()
    await expect(current).toHaveAccessibleDescription('Senha atual incorreta.')

    await current.fill(BRUNO.password)
    await passwordForm(page).getByRole('button', { name: 'Alterar senha' }).click()
    await expect(toast(page, 'Senha alterada.')).toBeVisible()

    await logout(page)
    await page.goto('/login')
    await submitLogin(page, BRUNO)
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await submitLogin(page, { email: BRUNO.email, password: 'NovaSenha9' })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
