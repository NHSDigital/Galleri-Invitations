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
    - [variables](#variables)
    - [outputs](#outputs)
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

This repository utilizes a modular approach to terraform, the config can be found under the `terraform` directory. The `main.yaml` file contains the code which calls the modules and passes in the required variables.

under that directory we have the `modules` directory which has the code which is in logical groups. This makes it easier and quicker to reproduce multiple similar resources.

there is the `environments` directory, this contains the `tfvar` files that define environment specific variables. these are what our pipelines will use when deploying into different environments.

We also have a `src` directory, this is where we keep any code or config which will be utilized by resources created within terraform, for example the lambda functions are defined here, along with unit tests.

To run this config locally you will need to pass in the location of the tfvars file that you want to use, this will depend on the environment you want to deploy into, assuming you want to deploy into the dev environment then you would want to run `tf apply -var-file=environment/dev/terraform.tfvars`, to destroy the environment its the same format `tf destroy -var-file=environment/dev/terraform.tfvars`.

### variables

Variables are a little complicated so I feel they are worth their own section. The way modules work is to batch together a number of terraform resources into a logical group to achieve a goal. For example we have an API gateway module which includes the methods and options for creating an API gateway and being able to interact with it. as we have multiple api gateways that operate in a similar way we can use the module as a template and pass in variables where things need to change.

This process starts at the module level. Here we define a variable for any value that may change. When there is a sensible default value which is commonly used we will set that as the `default` which means unless an overwrite is passed in that value will be used, otherwise it will use the default. This saves on a lot of unnecessary values being passed into the module.

sometimes there are variables which we don't want to set a default on, this may be because every version will need a unique field or because we don't want someone to accidentally use the wrong value.

once the variables have been defined in the module we then call that module from the `terraform/main.tf` file. we will have to enter in all the required variables which don't have defaults and supply any overwrites for variables were we don't want to use the default.

We also have some variables which will be consistent for everything within an environment but change between them, for example we may want to prefix all resource names in the dev environment with `dev-` and in the test environment `test-`. This can be defined in the `tfvars` files in the `environment` directory.

when using tfvars they are similar to other var references but passed in from the main file. so you may end up with a chain of vars which start in the module as something like `var.name_prefix` then in the `main.tf` file it passes in `var.environment` and the `environment` variable is defined in the tfvar file.

you can also pass in variables as environment variables. to do this you create the variable with the prefix of `TF_VAR_` so for environment you would use `TF_VAR_environment`. This is useful when you need to pass in a secret value.

### outputs

There are times when a resource inside a module will require some information from a different resource in another module. We can supply this using outputs. Each module has an `output.tf` file, inside that it will supply an output based on a value from a resource within that modules. For example in the `api-gateway` module we have an output called `rest_api_galleri_execution_arn` we can call that output to get that value from the main file by calling the module and output.

So if we have a module defined in the main branch which is called `my-api` which is calling the `api-gateway` module then we can get the output by calling `module.my-api.rest_api_galleri_execution_arn`, this is the same way you would call a resource or data block so its consistent with references.

## Contributing

## Contacts

Maintainers: David Lavender, Zain Malik, Mandeep Sandhu, Andrew Cleveland

## Licence

> The [LICENCE.md](./LICENCE.md) file will need to be updated with the correct year and owner
