# Repository Template

This is a repo containing the code for the Galleri Invitations Algorithm

## Table of Contents

- [Repository Template](#repository-template)
  - [Table of Contents](#table-of-contents)
  - [Usage](#usage)
    - [Github Actions](#github-actions)
      - [workflow select](#workflow-select)
      - [Galleri Invitations branch/tag](#galleri-invitations-branchtag)
      - [Galleri Frontend branch/tag](#galleri-frontend-branchtag)
      - [Seeding scripts](#seeding-scripts)
      - [terraform action](#terraform-action)
    - [Sonar](#sonar)
    - [Configuration](#configuration)
  - [Prettifier](#prettifier)
  - [Terraform](#terraform)
    - [variables](#variables)
    - [outputs](#outputs)
  - [Contributing](#contributing)
  - [Contacts](#contacts)
  - [Licence](#licence)

## Usage

The configuration for the Galleri Invitations sytem is managed by Terraform. We have a series of pipelines which work across multiple environments from development, testing, UAT, performance and production. If you want to run terraform to deploy this code directly from the branch you can do so by running the following command from the terraform directory `tf apply -var-file=environment/dev/terraform.tfvars`

However the better way to do this would be to login to the github repository and run the associated action to deploy the environment.

### Github Actions

To manually deploy the changes into an environment you first want to go to [github actions](https://github.com/NHSDigital/Galleri-Invitations/actions)

Next you want to select the workflow that you want to run, there are three for DEV and three for UAT. Select one which is not being used (Check with colleagues to verify)

Select `Run workflow` from the top right hand corner and then a dropdown menu will appear. There are a few options you can choose:

#### workflow select

This is the pipeline configuration that should be used, unless you are testing changes to a github action then leave this as `main`

#### Galleri Invitations branch/tag

This is the branch or tag of the invitations repo you want to deploy, if you just want a working environment then just put `main` and it will pull the latest from the main branch. Otherwise put in the full branch name, such as `feature/GAL-175`

#### Galleri Frontend branch/tag

This is the branch or tag of the frontend repo you want to deploy, if you just want a working environment then just put `main` and it will pull the latest from the main branch. Otherwise put in the full branch name, such as `feature/GAL-175`

#### Seeding scripts

This determines if the database seeding scripts will be run, if you want an empty database then you can delete the existing database for that environment (if it already exists) and then run a fresh apply with this set to `no`

#### terraform action

This can be either `apply` to apply the terraform from that branch, or `destroy` to tear down the environment

### Sonar

SonarCloud provides static code analysis across terraform, js, configs, etc.
Local:
Before pushing to the repo, the developer must run the following commands to run sonarcloud locally;

```bash
sonar-scanner -Dsonar.host.url=https://sonarcloud.io -Dsonar.organization=nhsdigital -Dsonar.projectKey=galleri-invitations -Dsonar.sources=.
```

SonarCloud:
SonarScanner also gets run as part of GitHub pipeline.
Tip: when looking at feature branches in SonarCloud, they will ONLY show bad code smells for NEW code: don't expect to see any code in the report if nothing has changed from main.

This will run a series of tests to check that the backend lambda services exposed by API Gateways are working.

> **Note** currently these only work in the dev environment but in the future will be expanded to work in all environments

### Configuration

Most of the projects are built with customisability and extendability in mind. At a minimum, this can be achieved by implementing service level configuration options and settings. The intention of this section is to show how this can be used. If the system processes data, you could mention here for example how the input is prepared for testing - anonymised, synthetic or live data.

## Prettifier

For linting we have decided to use [prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) Which we have created config files for called `.prettierrc.yaml` This file enforces consistancy between all users.

To set this up you need to install the prettier plugin using the link above.

Once it is installed you can set up the default formatter by opening a file in the repo and using the shortcut `ctrl + p` to open the vscode command interface. Then enter `> Format Document` and select `Format Document` from the dropdown. The first time you do this it will say something like **No default formatter setup for this project** You can click on the `Configure` button and select Prettier from that list.

To make formatting easier you can enable **Format on Save** by going into preferences and searching for `format on save` then check the tickbox to enable it. Now everytime you save your file with `ctrl + s` or `command + s` then it will format the file for you.

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

One required variable is `TF_VAR_frontend_repo_location` which is required to tell terraform where the repo is located on your system, the default is the location it is found in the gitlab runner.

when using tfvars they are similar to other var references but passed in from the main file. so you may end up with a chain of vars which start in the module as something like `var.name_prefix` then in the `main.tf` file it passes in `var.environment` and the `environment` variable is defined in the tfvar file.

you can also pass in variables as environment variables. to do this you create the variable with the prefix of `TF_VAR_` so for environment you would use `TF_VAR_environment`. This is useful when you need to pass in a secret value.

### outputs

There are times when a resource inside a module will require some information from a different resource in another module. We can supply this using outputs. Each module has an `output.tf` file, inside that it will supply an output based on a value from a resource within that modules. For example in the `api-gateway` module we have an output called `rest_api_galleri_execution_arn` we can call that output to get that value from the main file by calling the module and output.

So if we have a module defined in the main branch which is called `my-api` which is calling the `api-gateway` module then we can get the output by calling `module.my-api.rest_api_galleri_execution_arn`, this is the same way you would call a resource or data block so its consistent with references.

## Contributing

## Contacts

Maintainers: David Lavender, Zain Malik, Mandeep Sandhu, Andrew Cleveland, Cheng Lawson

## Licence

> The [LICENCE.md](./LICENCE.md) file will need to be updated with the correct year and owner
