
Each form in the app has a unique id (subscription1, contact-us2, etc.)

The settings allow whether users can submit one or multiple submission for each form - for now, we allow multiple submission for all forms, however, it loads the last submitted data in the form if found

it guards against spams (using otehr channels connected to recapcha or similar services)

The plugin is smart, it stores the submitted form data in frontend, and refers to the backend only if the data is not found - can become even smarter by using local storage (TODO)

