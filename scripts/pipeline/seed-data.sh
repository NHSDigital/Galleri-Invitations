#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# Options:
#   CHECK_ONLY=true # Do not format, run check only, default is `false`
#   VERBOSE=true    # Show all the executed commands, default is `false`

# ==============================================================================


# ==============================================================================

function main() {

  aws dynamodb put-item \
    --table-name sdrs_table  \
    --item \
        '{"NhsNumber": {"N": "999999999"},
          "GivenName": {"S": "Zain"},
          "TelephoneNumberMobile": {"S": "0800800800A"},
          "EmailAddressHome": {"S": "no_email@email.com"}
        }'
}

# function is-arg-true() {

#   if [[ "$1" =~ ^(true|yes|y|on|1|TRUE|YES|Y|ON)$ ]]; then
#     return 0
#   else
#     return 1
#   fi
# }

# ==============================================================================

# is-arg-true "$VERBOSE" && set -x

main $*

exit 0




