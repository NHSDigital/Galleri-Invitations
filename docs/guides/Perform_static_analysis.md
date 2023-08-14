# Guide: Perform static analysis

- [Guide: Perform static analysis](#guide-perform-static-analysis)
  - [Overview](#overview)
  - [Key files](#key-files)
  - [Configuration checklist](#configuration-checklist)
  - [Testing](#testing)

## Overview

Static code analysis is an essential part of modern software development. It provides automatic checks on your codebase to identify potential bugs, code smells, security vulnerabilities, and maintainability issues.

[SonarCloud](https://sonarcloud.io), an online service for continuous code quality inspection and static analysis, can be easily integrated with a GitHub repository. This repository template includes all the necessary setup for minimal configuration on your part, facilitating smooth integration with this SaaS offering.

## Key files

- [perform-static-analysis.sh](../../scripts/reports/perform-static-analysis.sh): A shell script that performs analysis
- [sonar-scanner.properties](../../scripts/config/sonar-scanner.properties): A configuration file that includes the project details
- [perform-static-analysis/action.yaml](../../.github/actions/perform-static-analysis/action.yaml): GitHub action to run the script as part of the CI/CD pipeline
- [.gitignore](../../.gitignore): Excludes the `.scannerwork` temporary directory created during the process

## Configuration checklist

- Create your [SonarCloud](https://sonarcloud.io) project
- Navigate to project `Administration > Analysis Method > Manually` and select `Other (for JS, TS, Go, Python, PHP, ...)`
- In the [sonar-scanner.properties](../../scripts/config/sonar-scanner.properties) file, set the following properties according to the information provided above
  - `sonar.organization`
  - `sonar.projectKey`
  - `sonar.[language].[coverage-tool].reportPaths` to ensure the unit test coverage is reported back to Sonar
- Follow the documentation on [creating encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to add the `SONAR_TOKEN` secret to your repository. The GitHub action is already configured to fetch that secret and pass it as a variable
- Navigate to project `Administration > Analysis Method` and turn off the `Automatic Analysis` option
- Confirm that the GitHub action is part of your GitHub CI/CD workflow and enforces the "Sonar Way" quality gates. You can find more information about this in the [NHSE Software Engineering Quality Framework](https://github.com/NHSDigital/software-engineering-quality-framework/blob/main/tools/sonarqube.md)

## Testing

You can run and test static analysis locally on a developer's workstation using the following command and export the sonar token as env variable

```shell
./scripts/perform-static-analysis.sh
```
