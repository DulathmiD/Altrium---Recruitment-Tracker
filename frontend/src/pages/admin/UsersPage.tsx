import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  listUsers,
  updateUser,
  setUserActive,
  setUserRole,
  type User,
  type Role,
} from "../../api/users";
import PasswordConfirmModal from "../../components/PasswordConfirmModal";
import Toast from "../../components/Toast";
import "./UsersPage.css";

const ROLES: Role[] = ["HR", "INTERVIEWER", "MANAGEMENT", "HIRING_MANAGER", "IT_ADMIN", "LEADERSHIP_MANAGEMENT"];

const ROLE_LABELS: Record<Role, string> = {
  HR: "HR",
  INTERVIEWER: "Interviewer",
  MANAGEMENT: "Management",
  HIRING_MANAGER: "Hiring Manager",
  IT_ADMIN: "IT Admin",
  LEADERSHIP_MANAGEMENT: "Leadership Management",
};

type EditFormState = { name: string; email: string; department: string };

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: "", email: "", department: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [roleForm, setRoleForm] = useState<Role>("HR");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState("");

  // Password-confirm gates: one for the Create User redirect, one for
  // deactivating/activating the account currently open in the edit popup.
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listUsers({
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter ? { isActive: statusFilter === "active" } : {}),
      });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }

  function openEditForm(u: User) {
    setEditingUser(u);
    setEditForm({ name: u.name, email: u.email, department: u.department ?? "" });
    setEditError("");
  }

  async function handleEditSave() {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError("Name and email are required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      await updateUser(editingUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        department: editForm.department.trim(),
      });
      setEditingUser(null);
      await refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not update user");
    } finally {
      setEditSaving(false);
    }
  }

  function openRoleForm(u: User) {
    setRoleTarget(u);
    setRoleForm(u.role);
    setRoleError("");
  }

  async function handleRoleSave() {
    if (!roleTarget) return;
    setRoleSaving(true);
    setRoleError("");
    try {
      await setUserRole(roleTarget.id, roleForm);
      setRoleTarget(null);
      await refresh();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setRoleSaving(false);
    }
  }

  // Deactivate/activate now lives behind a password-confirm step, launched
  // from inside the edit popup rather than a standalone row button.
  function requestToggleActive() {
    if (!editingUser) return;
    setDeactivateTarget(editingUser);
    setEditingUser(null);
  }

  async function handleToggleActiveConfirmed() {
    if (!deactivateTarget) return;
    const nextActive = !deactivateTarget.isActive;
    await setUserActive(deactivateTarget.id, nextActive);
    setSuccessMessage(
      nextActive
        ? `${deactivateTarget.name} was successfully activated.`
        : `${deactivateTarget.name} was successfully deactivated.`
    );
    setDeactivateTarget(null);
    await refresh();
  }

  return (
    <div className="usr-page">
      <div className="usr-header-row">
        <h1 className="usr-title">Users</h1>
        <button className="usr-create-btn" onClick={() => setConfirmingCreate(true)}>Create User</button>
      </div>
      <div className="usr-divider" />

      <div className="usr-filters">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading && <p className="usr-muted">Loading...</p>}
      {error && <p className="usr-error">{error}</p>}
      {!loading && users.length === 0 && <p className="usr-muted">No users match these filters.</p>}

      {!loading && users.length > 0 && (
        <table className="usr-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = currentUser?.id === u.id;
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <button
                      className="usr-role-btn"
                      onClick={() => openRoleForm(u)}
                      disabled={isSelf}
                      title={isSelf ? "You cannot change your own role" : "Change role"}
                    >
                      {ROLE_LABELS[u.role]}
                    </button>
                  </td>
                  <td>{u.department ?? "—"}</td>
                  <td>
                    <span className={"usr-status-pill " + (u.isActive ? "active" : "inactive")}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="usr-row-actions">
                    <button className="usr-edit-btn" onClick={() => openEditForm(u)} aria-label="Edit user">
                      &#9998;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editingUser && (
        <div className="usr-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit User</h2>

            <label htmlFor="usr-edit-name">Name</label>
            <input id="usr-edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />

            <label htmlFor="usr-edit-email">Email</label>
            <input id="usr-edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />

            <label htmlFor="usr-edit-department">Department</label>
            <input id="usr-edit-department" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />

            <div className="usr-edit-created">Created: {new Date(editingUser.createdAt).toLocaleString()}</div>

            {editError && <p className="usr-error">{editError}</p>}

            <div className="usr-modal-footer">
              <button
                className={"usr-toggle-btn " + (editingUser.isActive ? "deactivate" : "activate")}
                onClick={requestToggleActive}
                disabled={currentUser?.id === editingUser.id && editingUser.isActive}
                title={currentUser?.id === editingUser.id && editingUser.isActive ? "You cannot deactivate your own account" : undefined}
              >
                {editingUser.isActive ? "Deactivate" : "Activate"}
              </button>
              <div className="usr-modal-actions">
                <button className="usr-cancel-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                <button className="usr-save-btn" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {roleTarget && (
        <div className="usr-modal-backdrop" onClick={() => setRoleTarget(null)}>
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change Role — {roleTarget.name}</h2>

            <label htmlFor="usr-role-select">Role</label>
            <select id="usr-role-select" value={roleForm} onChange={(e) => setRoleForm(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>

            {roleError && <p className="usr-error">{roleError}</p>}

            <div className="usr-modal-actions">
              <button className="usr-cancel-btn" onClick={() => setRoleTarget(null)}>Cancel</button>
              <button className="usr-save-btn" onClick={handleRoleSave} disabled={roleSaving}>
                {roleSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingCreate && (
        <PasswordConfirmModal
          title="Confirm Your Password"
          message="Enter your password to continue to Create User."
          confirmLabel="Continue"
          onCancel={() => setConfirmingCreate(false)}
          onConfirmed={() => {
            setConfirmingCreate(false);
            navigate("/admin/users/create");
          }}
        />
      )}

      {deactivateTarget && (
        <PasswordConfirmModal
          title={deactivateTarget.isActive ? "Confirm Deactivation" : "Confirm Activation"}
          message={
            deactivateTarget.isActive
              ? `Enter your password to deactivate ${deactivateTarget.name}'s account.`
              : `Enter your password to reactivate ${deactivateTarget.name}'s account.`
          }
          confirmLabel={deactivateTarget.isActive ? "Deactivate" : "Activate"}
          danger={deactivateTarget.isActive}
          onCancel={() => setDeactivateTarget(null)}
          onConfirmed={handleToggleActiveConfirmed}
        />
      )}

      {successMessage && (
        <Toast message={successMessage} onClose={() => setSuccessMessage("")} />
      )}
    </div>
  );
}
