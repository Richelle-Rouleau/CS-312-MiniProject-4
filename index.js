import express from "express";
import session from "express-session";
import pool from "./db.js";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from .env");
}

const app = express();
const port = 3000;

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

function requireSignIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "You must be signed in.",
    });
  }

  next();
}

app.get("/api/me", (req, res) => {
  res.json({
    user: req.session.user ?? null,
  });
});

app.post("/api/signup", async (req, res) => {
  const name = req.body.name?.trim();
  const password = req.body.password;

  if (!name || !password) {
    return res.status(400).json({
      error: "Please enter a name and password.",
    });
  }

  try {
    const existing = await pool.query(
      `SELECT user_id
       FROM users
       WHERE LOWER(name) = LOWER($1)`,
      [name],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "That name is already taken.",
      });
    }

    const sequenceResult = await pool.query(
      "SELECT nextval('user_id_num_seq') AS number",
    );

    const userId = `user-${sequenceResult.rows[0].number}`;

    const result = await pool.query(
      `INSERT INTO users (user_id, name, password)
       VALUES ($1, $2, $3)
       RETURNING user_id, name`,
      [userId, name, password],
    );

    req.session.user = result.rows[0];

    res.status(201).json({
      message: "Account created successfully.",
      user: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "That name is already taken.",
      });
    }

    console.error("Error creating account:", err);

    res.status(500).json({
      error: "Error creating account.",
    });
  }
});

app.post("/api/signin", async (req, res) => {
  const name = req.body.name?.trim() ?? "";
  const password = req.body.password ?? "";

  try {
    const result = await pool.query(
      `SELECT user_id, name
       FROM users
       WHERE LOWER(name) = LOWER($1)
         AND password = $2`,
      [name, password],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Incorrect name or password.",
      });
    }

    req.session.user = result.rows[0];

    res.json({
      message: "Signed in successfully.",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error signing in:", err);

    res.status(500).json({
      error: "Error signing in.",
    });
  }
});

app.post("/api/signout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error signing out:", err);

      return res.status(500).json({
        error: "Error signing out.",
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      message: "Signed out successfully.",
    });
  });
});

app.get("/api/posts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.blog_id AS id,
        COALESCE(
          NULLIF(u.name, ''),
          NULLIF(b.creator_name, ''),
          'Unknown'
        ) AS author,
        b.creator_user_id,
        b.title,
        b.body AS content,
        TO_CHAR(
          b.date_created,
          'YYYY-MM-DD HH24:MI:SS'
        ) AS date
      FROM blogs b
      LEFT JOIN users u
        ON b.creator_user_id = u.user_id
      ORDER BY b.blog_id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching blog posts:", err);

    res.status(500).json({
      error: "Error fetching blog posts.",
    });
  }
});

app.post("/api/posts", requireSignIn, async (req, res) => {
  const { title, content } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({
      error: "Title and content are required.",
    });
  }

  const user = req.session.user;

  try {
    const result = await pool.query(
      `INSERT INTO blogs
         (title, body, creator_name, creator_user_id, date_created)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING
         blog_id AS id,
         title,
         body AS content,
         creator_name AS author,
         creator_user_id,
         date_created AS date`,
      [title.trim(), content.trim(), user.name, user.user_id],
    );

    res.status(201).json({
      message: "Blog post created successfully.",
      post: result.rows[0],
    });
  } catch (err) {
    console.error("Error creating blog post:", err);

    res.status(500).json({
      error: "Error creating blog post.",
    });
  }
});

app.get("/api/posts/:id", requireSignIn, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Invalid blog post ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         blog_id AS id,
         title,
         body AS content
       FROM blogs
       WHERE blog_id = $1
         AND creator_user_id = $2`,
      [id, req.session.user.user_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Blog post not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching blog post:", err);

    res.status(500).json({
      error: "Error fetching blog post.",
    });
  }
});

app.put("/api/posts/:id", requireSignIn, async (req, res) => {
  const id = Number(req.params.id);
  const { title, content } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Invalid blog post ID.",
    });
  }

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({
      error: "Title and content are required.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE blogs
       SET title = $1, body = $2
       WHERE blog_id = $3
         AND creator_user_id = $4
       RETURNING blog_id`,
      [title.trim(), content.trim(), id, req.session.user.user_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Blog post not found.",
      });
    }

    res.json({
      message: "Blog post updated successfully.",
    });
  } catch (err) {
    console.error("Error updating blog post:", err);

    res.status(500).json({
      error: "Error updating blog post.",
    });
  }
});

app.delete("/api/posts/:id", requireSignIn, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Invalid blog post ID.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM blogs
       WHERE blog_id = $1
         AND creator_user_id = $2
       RETURNING blog_id`,
      [id, req.session.user.user_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Blog post not found.",
      });
    }

    res.json({
      message: "Blog post deleted successfully.",
    });
  } catch (err) {
    console.error("Error deleting blog post:", err);

    res.status(500).json({
      error: "Error deleting blog post.",
    });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
