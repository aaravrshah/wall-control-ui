import TopNav from './TopNav';

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <TopNav />
      <main className="main-content">{children}</main>
    </div>
  );
}
