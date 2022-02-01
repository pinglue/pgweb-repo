
login flow
---------------------

failure:
@login-pl/--login (internal) -> @login-failed

success:
@login-pl/--login (internal) -> @login-success -> @logged-in


logout flow
---------------------------
(frontend cmd) -> @logged-out

