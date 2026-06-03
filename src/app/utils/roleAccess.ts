export type AppRole = string;

export interface RolePermissions {
  moduleAccess: string[];
  permissionMatrix: string[];
  dataAccess: string[];
}

export interface RoleDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  users: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
  permissions: RolePermissions;
}

const USER_ROLES_STORAGE_KEY = 'honey_translation_user_roles';
const REGISTERED_USERS_STORAGE_KEY = 'registered_users';
const ROLES_STORAGE_KEY = 'honey_roles';
const ADMIN_EMAILS = new Set(['admin@honeytranslations.com', 'swetha@gmail.com']);
const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();
const normalizeRoleKey = (role: unknown): string => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return 'customer';
  if (value === 'sales manager' || value === 'manager') return 'sales_manager';
  return value.replace(/\s+/g, '_');
};

export const normalizeAppRole = (role: unknown): AppRole => {
  return normalizeRoleKey(role);
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

const getRoleDefinitions = (): RoleDefinition[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Array<Partial<RoleDefinition> & { key?: string; permissions?: Partial<RolePermissions> }>;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((role) => {
      const key = normalizeRoleKey(role.key ?? role.name);
      return {
        id: role.id || `role-${key}`,
        key,
        name: role.name || key,
        description: role.description || '',
        users: Number(role.users || 0),
        status: role.status === 'Inactive' ? 'Inactive' : 'Active',
        createdAt: role.createdAt || new Date().toISOString(),
        permissions: {
          moduleAccess: Array.isArray(role.permissions?.moduleAccess) ? role.permissions!.moduleAccess.map(String) : [],
          permissionMatrix: Array.isArray(role.permissions?.permissionMatrix) ? role.permissions!.permissionMatrix.map(String) : [],
          dataAccess: Array.isArray(role.permissions?.dataAccess) ? role.permissions!.dataAccess.map(String) : [],
        },
      };
    });
  } catch {
    return [];
  }
};

export const getRoleDefinition = (role?: string | null): RoleDefinition | null => {
  const key = normalizeRoleKey(role);
  const definition = getRoleDefinitions().find((item) => item.key === key);
  return definition || null;
};

export const canAccessRoleFeature = (role?: string | null, featureKey?: string | null): boolean => {
  const key = normalizeRoleKey(role);
  const normalizedFeature = normalizeRoleKey(featureKey);

  if (!normalizedFeature) return false;
  if (key === 'admin' || key === 'sales_manager') return true;

  const definition = getRoleDefinition(key);
  if (!definition) return false;

  const allPermissions = [
    ...definition.permissions.moduleAccess,
    ...definition.permissions.permissionMatrix,
    ...definition.permissions.dataAccess,
  ].map(normalizeRoleKey);

  return allPermissions.includes(normalizedFeature);
};

export const resolveAppRole = (
  email?: string | null,
  runtimeRole?: unknown,
): AppRole => {
  const emailKey = normalizeEmail(email);
  if (emailKey && ADMIN_EMAILS.has(emailKey)) {
    return 'admin';
  }
  const storedRole = getStoredRole(emailKey);
  const registeredRole = getRegisteredRole(emailKey);

  if (storedRole) {
    return storedRole;
  }

  if (registeredRole) {
    return registeredRole;
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
  return role === 'admin' || role === 'sales_manager' || !!getRoleDefinition(role);
};

export const isFullAdmin = (
  email?: string | null,
  runtimeRole?: unknown,
): boolean => {
  return resolveAppRole(email, runtimeRole) === 'admin';
};

export const isSalesManager = (
  email?: string | null,
  runtimeRole?: unknown,
): boolean => {
  return resolveAppRole(email, runtimeRole) === 'sales_manager';
};
