import { Route, Switch, Link, useLocation } from "wouter";
import Dashboard from "./pages/Dashboard";
import SessionView from "./pages/SessionView";

export default function App() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-paper/10 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <h1 className="font-display text-3xl tracking-wider text-gold cursor-pointer hover:text-gold/80 transition">
            PLINKATRON
          </h1>
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/" className={location === "/" ? "text-paper" : "hover:text-paper transition"}>
            Sessions
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/session/:id" component={SessionView} />
          <Route>
            <div className="text-center py-20">
              <p className="text-muted text-lg">Page not found</p>
              <Link href="/" className="text-gold hover:underline mt-4 inline-block">Back to sessions</Link>
            </div>
          </Route>
        </Switch>
      </main>
    </div>
  );
}
