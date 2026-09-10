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

// Same canonical 8-department list the Vacancies page uses (HR's
// department-browse cards) -- one shared vocabulary across the app rather
// than IT Admin being able to free-type a department that no vacancy will
// ever match.
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

type FormState = {
  name: string;
  phoneNumber: string;
  email: string;
  role: Role;
  department: string;
  password: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { name: "", phoneNumber: "", email: "", role: "HR", department: DEPARTMENTS[0], password: "" };

// Real name, not just "not empty" -- letters, spaces, hyphens, and
// apostrophes only (covers "Mary-Jane", "O'Brien"), at least 2 characters so
// a stray single keystroke doesn't pass.
const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{1,}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sri Lankan numbers: 10 digits domestically starting with 0 (e.g.
// 0771234567), or +94 followed by 9 digits internationally
// (+94771234567) -- the leading 0 is dropped when the country code is used.
// Digits only either way, so this also covers "no letters allowed."
const PHONE_PATTERN = /^(?:0\d{9}|\+94\d{9})$/;

const MIN_PASSWORD_LENGTH = 8; // matches the backend's own check -- see note below

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const next: FieldErrors = {};

    const name = form.name.trim();
    if (!name) next.name = "Name is required.";
    else if (!NAME_PATTERN.test(name)) next.name = "Enter a full name (letters only, at least 2 characters).";

    const email = form.email.trim();
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email)) next.email = "Enter a valid email address.";

    const phone = form.phoneNumber.trim();
    if (!phone) next.phoneNumber = "Contact number is required.";
    else if (!PHONE_PATTERN.test(phone)) next.phoneNumber = "Enter a valid Sri Lankan number: 07XXXXXXXX or +947XXXXXXXX, digits only.";

    // No error path needed here -- department is now a <select> constrained
    // to DEPARTMENTS, same as role, so it can never be empty or invalid.

    if (!form.password) next.password = "Initial password is required.";
    else if (form.password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

    setErrors(next);
    const hasErrors = Object.keys(next).length > 0;
    setFormError(hasErrors ? "Fix the highlighted fields before continuing." : "");
    return !hasErrors;
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

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm({ ...form, [key]: value });
    // Clear that field's error as soon as they start correcting it, rather
    // than making them re-click Create to see it disappear.
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
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
              <button className="cru-secondary-btn" onClick={() => { setForm(EMPTY_FORM); setErrors({}); setFormError(""); setSuccess(false); }}>
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
            <input
              id="cru-name"
              className={errors.name ? "cru-input-error" : ""}
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
            {errors.name && <p className="cru-field-error">{errors.name}</p>}
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-phone">Contact Number</label>
            <input
              id="cru-phone"
              className={errors.phoneNumber ? "cru-input-error" : ""}
              placeholder="07XXXXXXXX or +947XXXXXXXX"
              value={form.phoneNumber}
              onChange={(e) => field("phoneNumber", e.target.value)}
            />
            {errors.phoneNumber && <p className="cru-field-error">{errors.phoneNumber}</p>}
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-email">Email</label>
            <input
              id="cru-email"
              type="email"
              className={errors.email ? "cru-input-error" : ""}
              value={form.email}
              onChange={(e) => field("email", e.target.value)}
            />
            {errors.email && <p className="cru-field-error">{errors.email}</p>}
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-password">Initial Password</label>
            <input
              id="cru-password"
              type="text"
              className={errors.password ? "cru-input-error" : ""}
              value={form.password}
              onChange={(e) => field("password", e.target.value)}
            />
            {errors.password && <p className="cru-field-error">{errors.password}</p>}
          </div>

          {/* Role and Department paired together deliberately -- both are
              fixed-list dropdowns now, so they read as one "categorize this
              account" row instead of being split across two rows. */}
          <div className="cru-form-field">
            <label htmlFor="cru-role">Role</label>
            <select id="cru-role" value={form.role} onChange={(e) => field("role", e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          <div className="cru-form-field">
            <label htmlFor="cru-department">Department</label>
            <select id="cru-department" value={form.department} onChange={(e) => field("department", e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <p className="cru-hint">
          At least {MIN_PASSWORD_LENGTH} characters. Share this with the user directly — there's no email-invite flow. They'll be required to change it on first login.
        </p>

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
