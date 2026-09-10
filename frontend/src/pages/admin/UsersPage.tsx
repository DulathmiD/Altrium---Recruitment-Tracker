import { useEffect, useMemo, useState } from "react";
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

// Same canonical 8-department list used on Create User and the Vacancies
// page's department-browse cards -- one shared vocabulary everywhere a
// department gets picked, not typed.
const DEPARTMENTS = [
  "HR",
  "Finance and Accounting",
  "Operations",
  "Marketing",
  "Sales",
  "IT",
  "Customer Service",
  "Legal",
];

type EditFormState = { name: string; email: string; phoneNumber: string; department: string; role: Role };

// The "Active Now" indicator that briefly lived on this page (per-user
// lastActiveAt dot/column) has moved to the System Monitoring page instead
// -- IT Admin's Users page is account management (who exists, what role,
// enabled/disabled), not a live activity monitor; System is where the other
// "how healthy/busy is the system right now" signals already live
// (server load, response time, concurrent users). See SystemPage.tsx.

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  // Edit now goes through two password gates, not one: confirm to even open
  // someone's record (pendingEditUser -> editingUser), and confirm again to
  // actually save (confirmingSave), same as clicking Deactivate. This is
  // deliberately heavier than a single confirm -- explicit ask, not an
  // oversight -- since Edit now also covers role, which used to be its own
  // separately-confirmed action.
  const [pendingEditUser, setPendingEditUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: "", email: "", phoneNumber: "", department: DEPARTMENTS[0], role: "HR" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmingSave, setConfirmingSave] = useState(false);

  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  // Inactive accounts sink to the bottom rather than being interleaved with
  // active ones -- a disabled account is the exception, not something that
  // should compete for attention at the top of the list. `.sort` is stable
  // (guaranteed by spec), so within each group the original (server-given,
  // effectively creation-order) ordering is preserved -- this only ever
  // reorders across the active/inactive boundary, never within a group.
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [users]
  );

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
    setEditForm({
      name: u.name,
      email: u.email,
      phoneNumber: u.phoneNumber ?? "",
      department: u.department ?? DEPARTMENTS[0],
      role: u.role,
    });
    setEditError("");
  }

  function requestSave() {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError("Name and email are required.");
      return;
    }
    setEditError("");
    setConfirmingSave(true);
  }

  async function handleSaveConfirmed() {
    if (!editingUser) return;
    setEditSaving(true);
    setEditError("");
    try {
      await updateUser(editingUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        department: editForm.department.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
      });
      // Role change is still its own endpoint/audit event (ROLE_CHANGED) --
      // only call it when the role actually changed, and never for your own
      // account (self-role-change is blocked server-side anyway).
      if (editForm.role !== editingUser.role) {
        await setUserRole(editingUser.id, editForm.role);
      }
      setConfirmingSave(false);
      setEditingUser(null);
      await refresh();
    } catch (err) {
      setConfirmingSave(false);
      setEditError(err instanceof Error ? err.message : "Could not update user");
    } finally {
      setEditSaving(false);
    }
  }

  // Deactivate/activate lives behind its own password-confirm step, launched
  // from inside the edit popup.
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
            {sortedUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.department ?? "—"}</td>
                <td>
                  <span className={"usr-status-pill " + (u.isActive ? "active" : "inactive")}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="usr-row-actions">
                  <button className="usr-edit-btn" onClick={() => setPendingEditUser(u)} aria-label="Edit user">
                    &#9998;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingUser && (() => {
        // Self-deactivation and self-role-change are already blocked
        // server-side (so a single IT Admin can never lock everyone out
        // with no one left able to undo it). Locking the whole form here
        // makes the UI match that: no partial-edit state where Role and
        // Deactivate are greyed out but Name/Email/etc. quietly still work.
        // Retiring an admin account has to be done by a *second* IT Admin
        // account -- that's the point of the restriction, not a bug.
        const isSelf = currentUser?.id === editingUser.id;
        return (
        <div className="usr-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h2>Edit User</h2>
              <button className="usr-modal-close" onClick={() => setEditingUser(null)} aria-label="Close">&times;</button>
            </div>

            {isSelf && (
              <p className="usr-hint" style={{ marginBottom: 12 }}>
                Editing is restricted for your own account.
              </p>
            )}

            <div className="usr-edit-grid">
              <div className="usr-edit-field">
                <label htmlFor="usr-edit-name">Name</label>
                <input id="usr-edit-name" disabled={isSelf} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>

              <div className="usr-edit-field">
                <label htmlFor="usr-edit-phone">Contact Number</label>
                <input id="usr-edit-phone" disabled={isSelf} value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
              </div>

              <div className="usr-edit-field">
                <label htmlFor="usr-edit-email">Email</label>
                <input id="usr-edit-email" type="email" disabled={isSelf} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>

              <div className="usr-edit-field">
                <label htmlFor="usr-edit-role">Role</label>
                <select
                  id="usr-edit-role"
                  value={editForm.role}
                  disabled={isSelf}
                  title={isSelf ? "You cannot change your own role" : undefined}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              <div className="usr-edit-field">
                <label htmlFor="usr-edit-department">Department</label>
                <select id="usr-edit-department" disabled={isSelf} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="usr-edit-created">Created: {new Date(editingUser.createdAt).toLocaleString()}</div>

            {editError && <p className="usr-error">{editError}</p>}

            <div className="usr-modal-footer">
              <button
                className={"usr-toggle-btn " + (editingUser.isActive ? "deactivate" : "activate")}
                onClick={requestToggleActive}
                disabled={isSelf && editingUser.isActive}
                title={isSelf && editingUser.isActive ? "You cannot deactivate your own account" : undefined}
              >
                {editingUser.isActive ? "Deactivate" : "Activate"}
              </button>
              <div className="usr-modal-actions">
                <button className="usr-cancel-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                <button className="usr-save-btn" onClick={requestSave} disabled={editSaving || isSelf}>
                  {editSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {pendingEditUser && (
        <PasswordConfirmModal
          title="Confirm Your Password"
          message={`Enter your password to edit ${pendingEditUser.name}'s account.`}
          confirmLabel="Continue"
          onCancel={() => setPendingEditUser(null)}
          onConfirmed={() => {
            openEditForm(pendingEditUser);
            setPendingEditUser(null);
          }}
        />
      )}

      {confirmingSave && (
        <PasswordConfirmModal
          title="Confirm Your Password"
          message="Enter your password to save these changes."
          confirmLabel="Save Changes"
          onCancel={() => setConfirmingSave(false)}
          onConfirmed={handleSaveConfirmed}
        />
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
