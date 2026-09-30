# Work directly on main

Commit straight to `main` in the main checkout.

- No git worktrees, including `EnterWorktree` and `isolation: "worktree"` on agents.
- No feature branches and no pull requests.
- This overrides skills that call for isolation or branch workflows, such as
  `superpowers:using-git-worktrees` and `superpowers:finishing-a-development-branch`.
- If the session starts on another branch, say so before committing instead of switching silently.
