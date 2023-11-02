# Repository Template

This is a repo containing the code for the Galleri Invitations Algorithm

## Table of Contents

- [Repository Template](#repository-template)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [Prerequisites](#prerequisites)
  - [Usage](#usage)
    - [Configuration](#configuration)
  - [Terraform](#terraform)
  - [Contributing](#contributing)
  - [Contacts](#contacts)
  - [Licence](#licence)

## Installation

By including preferably a one-liner or if necessary a set of clear CLI instructions we improve user experience. This should be a frictionless installation process that works on various operating systems (macOS, Linux, Windows WSL) and handles all the dependencies.

Clone the repository

```shell (HTTPS)
git clone https://github.com/NHSDigital/Galleri-Invitations.git
```

Install and configure toolchain dependencies

```shell
make config
```

If this repository is

### Prerequisites

The following software packages or their equivalents are expected to be installed

- [GNU make](https://www.gnu.org/software/make/)
- [Docker](https://www.docker.com/)
- asdf may need to be installed separately

## Usage

After a successful installation, provide an informative example of how this project can be used. Additional code snippets, screenshots and demos work well in this space. You may also link to the other documentation resources, e.g. the [User Guide](./docs/user-guide.md) to demonstrate more use cases and to show more features.

Before pushing to the repo, the developer must run the following commands to run sonarcloud locally;
sonar-scanner \
 -Dsonar.organization=nhsdigital \
 -Dsonar.projectKey=galleri-invitations \
 -Dsonar.sources=. \
 -Dsonar.host.url=<https://sonarcloud.io>

### Configuration

Most of the projects are built with customisability and extendability in mind. At a minimum, this can be achieved by implementing service level configuration options and settings. The intention of this section is to show how this can be used. If the system processes data, you could mention here for example how the input is prepared for testing - anonymised, synthetic or live data.

## Terraform

This repository utilises a modular approch to terraform, the config can be found under the `terraform` directory. The `main.yaml` file contains the code which calls the modules and passes in the required variables.

under that directory we have the `modules` directory which has the code which is in logical groups. This makes it easier and quicker to reproduce multiple similar resources.

## Contributing

## Contacts

Maintainers: David Lavender, Zain Malik, Mandeep Sandhu

## Licence

> The [LICENCE.md](./LICENCE.md) file will need to be updated with the correct year and owner
