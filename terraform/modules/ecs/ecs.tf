resource "aws_ecs_cluster" "cluster" {
  name = var.name
}

resource "aws_ecs_task_definition" "fhir_validator" {
  family                   = var.task_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = var.task_name,
      image     = var.image,
      cpu       = 256,
      memory    = 512,
      essential = true,
      portMappings = [
        {
          containerPort = 9001,
          hostPort      = 80,
          protocol      = "tcp"
        }
      ],
      environment = [
        {
          name  = "fhir.igs",
          value = "fhir.r4.ukcore.stu3.currentbuild#0.0.8-pre-release"
        },
        {
          name  = "fhir.server.baseUrl",
          value = "http://localhost"
        }
      ]
    }
  ])
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = var.task_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Effect = "Allow",
        Sid    = ""
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_service" "fhir_validator_service" {
  name            = var.task_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.fhir_validator.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    assign_public_ip = true
    security_groups  = ["your-security-group-id"] # Replace with your security group ID
  }

  #   network_configuration {
  #     subnets          = ["your-subnet-id1", "your-subnet-id2"] # Replace with your subnet IDs
  #     assign_public_ip = true
  #     security_groups  = ["your-security-group-id"] # Replace with your security group ID
  #   }
}
