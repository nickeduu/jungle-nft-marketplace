/**
 * Account field rules shared by the forms (immediate feedback) and the simulated API (which
 * enforces them again and answers 422 with `fieldErrors`). Each returns a message or null.
 */
const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,19}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN_LENGTH = 8

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value)
  if (!username) return 'Informe o nome de usuário.'
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use de 3 a 20 caracteres: letras, números, ponto ou sublinhado, começando por letra.'
  }
  return null
}

export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Informe o e-mail.'
  if (!EMAIL_PATTERN.test(email)) return 'Informe um e-mail válido.'
  return null
}

export function validateNewPassword(value: string): string | null {
  if (!value) return 'Informe a senha.'
  if (value.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`
  }
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Confirme a senha.'
  if (password !== confirmation) return 'As senhas não coincidem.'
  return null
}
