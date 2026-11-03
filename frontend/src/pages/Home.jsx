import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch("/api/posts");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load posts.");
        }

        setPosts(data.posts ?? data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this post?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete post.");
      }

      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== id));
    } catch (error) {
      setError(error.message);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      setError(error.message);
    }
  }

  if (loading) {
    return <p className="look-nice">Loading posts...</p>;
  }

  return (
    <main className="home-page">
      <div className="button-center">
        {user ? (
          <div className="home-buttons">
            <Link to="/create-post">
              <button className="my-btn" type="button">
                Create Post
              </button>
            </Link>

            <button
              className="my-btn delete"
              type="button"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="home-buttons">
            <Link to="/signin">
              <button className="my-btn" type="button">
                Sign In
              </button>
            </Link>

            <Link to="/signup">
              <button className="my-btn" type="button">
                Sign Up
              </button>
            </Link>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {posts.length === 0 ? (
        <p className="look-nice">
          <strong>No posts</strong>
        </p>
      ) : (
        <div className="posts-container">
          {posts.map((post) => (
            <article className="post-card" key={post.id}>
              <div className="post-card-body">
                <h2 className="post-title">{post.title}</h2>

                <p className="post-content">{post.content}</p>

                <p className="card-by">
                  <strong>By:</strong> {post.author}
                </p>

                <p className="card-time">
                  <strong>Created:</strong> {post.date}
                </p>

                {user && user.user_id === post.creator_user_id && (
                  <div className="post-actions">
                    <Link to={`/edit-post/${post.id}`}>
                      <button className="my-btn" type="button">
                        Edit
                      </button>
                    </Link>

                    <button
                      className="my-btn delete"
                      type="button"
                      onClick={() => handleDelete(post.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default Home;
