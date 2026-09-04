import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUser, type Role } from "../../api/users";
import PasswordConfirmModal from "../../components/PasswordConfirmModal";
import "./CreateUserPage.css";

const ROLES: Role[] = ["HR", "INTERVIEWER", "MANAGEMENT", "HIRING_MANAGER", "IT_ADMIN", "LEADERSHIP_MANAGEMENT"];

const ROLE_LABELS: Record<Role, string> = {
  HR: "HR",
  INTERVIEWER: "Interviewer",
  MANAGEMENT: "Management",
  HIRING_MANAGER: "Hiring Manager",
  IT_ADMIN: "IT Admin",
  LEADERSHIP_MANAGEMENT: "Leadership Management",
};

type FormState = {
  name: string;
  phoneNumber: string;
  email: string;
  role: Role;
  department: string;
  password: string;
};

const EMPTY_FORM: FormState = { name: "", phoneNumber: "", email: "", role: "HR", department: "", password: "" };

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    if (!form.name.trim() || !form.email.trim() || !form.role || !form.password) {
      setFormError("Name, email, password, and role are required.");
      return false;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return false;
    }
    setFormError("");
    return true;
  }

  async function handleCreateConfirmed() {
    await createUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      department: form.department.trim(),
      phoneNumber: form.phoneNumber.trim(),
    });
    setConfirming(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="cru-page">
        <div className="cru-breadcrumb">
          <Link to="/admin/users">Users</Link> / Create User
        </div>
        <div className="cru-success-wrap">
          <div className="cru-success-box">
            <div className="cru-success-icon">&#10003;</div>
            <h1 className="cru-success-title">User Created</h1>
            <p className="cru-success-message">
              {form.name}'s account has been created successfully. Share their initial password with them directly.
            </p>
            <div className="cru-success-actions">
              <button className="cru-secondary-btn" onClick={() => { setForm(EMPTY_FORM); setSuccess(false); }}>
                Create Another
              </button>
              <button className="cru-primary-btn" onClick={() => navigate("/admin/users")}>Back to Users</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cru-page">
      <div className="cru-breadcrumb">
        <Link to="/admin/users">Users</Link> / Create User
      </div>
      <h1 className="cru-title">Create User</h1>
      <div className="cru-divider" />

      <div className="cru-form-box">
        <div className="cru-form-grid">
          <div className="cru-form-field">
            <label htmlFor="cru-name">Name</label>
            <input id="cru-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-phone">Contact Number</label>
            <input id="cru-phone" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-email">Email</label>
            <input id="cru-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-role">Role</label>
            <select id="cru-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-department">Department (optional)</label>
            <input id="cru-department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-password">Initial Password</label>
            <input id="cru-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        <p className="cru-hint">At least 8 characters. Share this with the user directly — there's no email-invite flow.</p>

        {formError && <p className="cru-error">{formError}</p>}

        <div className="cru-form-actions">
          <button className="cru-secondary-btn" onClick={() => navigate("/admin/users")}>Cancel</button>
          <button className="cru-primary-btn" onClick={() => validate() && setConfirming(true)}>Create User</button>
        </div>
      </div>

      {confirming && (
        <PasswordConfirmModal
          title="Confirm Your Password"
          message="Enter your password to create this account."
          confirmLabel="Create User"
          onCancel={() => setConfirming(false)}
          onConfirmed={handleCreateConfirmed}
        />
      )}
    </div>
  );
}
