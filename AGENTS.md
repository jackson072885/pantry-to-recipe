\# Pantry-to-Recipe Agent Rules



This project is structured as:



pantry-to-recipe/

&nbsp;   backend/

&nbsp;   frontend/



Rules:



1\. Do not commit node\_modules.

2\. Do not commit .env, .env.local, or any secrets.

3\. Keep backend deterministic and production-safe.

4\. Do not break existing /match endpoint.

5\. Use SQLAlchemy session dependency pattern (get\_db).

6\. Keep frontend minimal and readable (no heavy UI libraries).

7\. Make clean commits with clear messages.

8\. Remove duplicate or unused folders instead of maintaining multiple versions.

9\. Run verification commands before declaring task complete.

