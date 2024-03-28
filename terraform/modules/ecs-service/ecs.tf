resource "aws_security_group" "service" {
  name        = "${var.environment}-${var.name}"
  description = "Security group for ${var.environment}-${var.name}"
  vpc_id      = var.vpc_id
}

resource "aws_security_group_rule" "service" {
  security_group_id = aws_security_group.service.id
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_iam_role" "ecs_tasks_execution_role" {
  name = "${var.environment}-${var.name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
      },
    ],
  })
}

resource "aws_iam_policy" "ecs_tasks_execution_policy" {
  name        = "${var.environment}-${var.name}-ecs-execution-policy"
  description = "A policy that allows ECS tasks to call AWS services on your behalf."
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_tasks_execution_policy_attachment" {
  role       = aws_iam_role.ecs_tasks_execution_role.name
  policy_arn = aws_iam_policy.ecs_tasks_execution_policy.arn
}

resource "aws_ecs_task_definition" "service" {
  family                   = "${var.environment}-${var.name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_tasks_execution_role.arn
  cpu                      = var.cpu
  memory                   = var.memory
  container_definitions = jsonencode([
    {
      name      = "${var.environment}-${var.name}"
      image     = var.image
      cpu       = var.cpu
      memory    = var.memory
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.host_port
        }
      ]
    }
  ])
}

resource "aws_ecs_service" "service" {
  name            = "${var.environment}-${var.name}"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.service.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  # iam_role        = aws_iam_role.service.arn

  network_configuration {
    subnets          = var.subnets
    assign_public_ip = var.public_ip
    security_groups  = [aws_security_group.service.id]
  }

  # placement_constraints {
  #   type       = "memberOf"
  #   expression = "attribute:ecs.availability-zone in [eu-west-2a, eu-west-2b]"
  # }
}
