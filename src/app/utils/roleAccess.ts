export type AppRole = 'admin' | 'sales_manager' | 'customer';

const USER_ROLES_STORAGE_KEY = 'honey_translation_user_roles';
const REGISTERED_USERS_STORAGE_KEY = 'registered_users';
const ADMIN_EMAILS = new Set(['admin@honeytranslations.com', 'swetha@gmail.com']);
const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export const normalizeAppRole = (role: unknown): AppRole => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'sales_manager' || value === 'sales manager' || value === 'manager') return 'sales_manager';
  return 'customer';
};

const getStoredRole = (email?: string | null): AppRole | null => {
  if (typeof window === 'undefined' || !email) return null;
  const emailKey = normalizeEmail(email);
  if (!emailKey) return null;

  try {
    const raw = localStorage.getItem(USER_ROLES_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const matchKey = Object.keys(parsed).find((key) => normalizeEmail(key) === emailKey);
    return matchKey ? normalizeAppRole(parsed[matchKey]) : null;
  } catch {
    return null;
  }
};

const getRegisteredRole = (email?: string | null): AppRole | null => {
  if (typeof window === 'undefined' || !email) return null;
  const emailKey = normalizeEmail(email);
  if (!emailKey) return null;

  try {
    const raw = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
    if (!raw) return null;

    const users = JSON.parse(raw) as Array<{ email?: string; role?: unknown }>;
    const match = users.find((user) => normalizeEmail(user.email) === emailKey);
    return match?.role ? normalizeAppRole(match.role) : null;
  } catch {
    return null;
  }
};

export const resolveAppRole = (
  email?: string | null,
  runtimeRole?: unknown,
): AppRole => {
  const emailKey = normalizeEmail(email);
  const storedRole = getStoredRole(emailKey);
  const registeredRole = getRegisteredRole(emailKey);

  if (storedRole) {
    return storedRole;
  }

  if (registeredRole) {
    return registeredRole;
  }

  if (emailKey && ADMIN_EMAILS.has(emailKey)) {
    return 'admin';
  }

  return normalizeAppRole(
    runtimeRole ??
    'customer'
  );
};

export const hasAdminAccess = (
  email?: string | null,
  runtimeRole?: unknown,
): boolean => {
  const role = resolveAppRole(email, runtimeRole);
  return role === 'admin' || role === 'sales_manager';
};
