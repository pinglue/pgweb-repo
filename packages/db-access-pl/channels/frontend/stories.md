
To accomodate UI interaction, all channels in this category contain the UI group id.

General flow:

@db-query -> @db-query-build -> @db-query-before-send -> @db-response-process -> @db-response

To simplify the process and avoid weird race condition, db-access-pl process one query per group - in other words, for any group, from the time channel @db-query is run until the time the channel @db-response you cannot run the channel @db-query again for the same group - doing so will return error message (err-db-busy) - UI design should facilitate this restriction by disabling action button when db is processing
