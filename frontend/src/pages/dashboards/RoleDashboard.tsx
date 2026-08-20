import { useAuth } from "../../context/AuthContext";

export default function RoleDashboard({ label }: { label: string }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: 32 }}>
      <h1>{label}</h1>
      <p>Signed in as <strong>{user?.name}</strong> ({user?.role})</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
