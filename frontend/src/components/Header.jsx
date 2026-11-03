import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const { user } = useAuth();
  const location = useLocation();

  let pageTitle = "My Blog";

  if (location.pathname === "/signin") {
    pageTitle = "Sign In";
  } else if (location.pathname === "/signup") {
    pageTitle = "Sign Up";
  } else if (location.pathname === "/create-post") {
    pageTitle = "Create Post";
  } else if (location.pathname.startsWith("/edit-post/")) {
    pageTitle = "Edit Post";
  }

  return (
    <header className="site-header">
      <h1 className="site-title">{pageTitle}</h1>

      {user && (
        <p className="welcome-text">
          Signed in as <strong>{user.name}</strong>
        </p>
      )}
    </header>
  );
}

export default Header;
