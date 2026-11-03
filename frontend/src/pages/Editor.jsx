import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEditing) return;

    async function fetchPost() {
      try {
        const response = await fetch(`/api/posts/${id}`, {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load post.");
        }

        const post = data.post ?? data;

        setTitle(post.title);
        setContent(post.content);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [id, isEditing]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(
        isEditing ? `/api/posts/${id}` : "/api/posts",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ title, content }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save post.");
      }

      navigate("/");
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="look-nice">Loading post...</p>;
  }

  return (
    <main className="editor-page">
      <section className="editor-container">
        <h2>{isEditing ? "Edit Post" : "Create a Post"}</h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit} className="post-form">
          <div className="form-group">
            <label htmlFor="title">
              <strong>Title:</strong>
            </label>

            <input
              type="text"
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <hr />

          <div className="form-group">
            <label htmlFor="content">
              <strong>Content:</strong>
            </label>

            <textarea
              id="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              rows={12}
            />
          </div>

          <button className="my-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : isEditing ? "Save" : "Create Post"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Editor;
