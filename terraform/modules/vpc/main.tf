# configure vpc
resource "aws_vpc" "my_vpc" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.environment}-${var.name}"
  }
}

# attach subnet to vpc
resource "aws_subnet" "my_subnet_a" {
  cidr_block              = "10.0.0.0/24"
  availability_zone       = "eu-west-2a"
  vpc_id                  = aws_vpc.my_vpc.id
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.environment}-${var.name}-a"
  }
}

# attach subnet to vpc
resource "aws_subnet" "my_subnet_b" {
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "eu-west-2b"
  vpc_id                  = aws_vpc.my_vpc.id
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.environment}-${var.name}-b"
  }
}

# set the gateway for the vpc
resource "aws_internet_gateway" "my_igw" {
  vpc_id = aws_vpc.my_vpc.id
}

# set the route table so instances can call out
resource "aws_route_table" "my_rt" {
  vpc_id = aws_vpc.my_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.my_igw.id
  }
}

# connect gateway to subnet
resource "aws_route_table_association" "my_rta" {
  subnet_id      = aws_subnet.my_subnet_a.id
  route_table_id = aws_route_table.my_rt.id
}

resource "aws_route_table_association" "my_rta_b" {
  subnet_id      = aws_subnet.my_subnet_b.id
  route_table_id = aws_route_table.my_rt.id
}

#subnets for eks
resource "aws_subnet" "fargate_a" {
  cidr_block        = "10.0.2.0/24"
  availability_zone = "eu-west-2a"
  vpc_id            = aws_vpc.my_vpc.id
  tags = {
    Name                                                           = "${var.environment}-${var.name}-fargate-a"
    "kubernetes.io/role/internal-elb"                              = "1"
    "kubernetes.io/cluster/${var.environment}-${var.cluster_name}" = "owned"
  }
}

resource "aws_subnet" "fargate_b" {
  cidr_block        = "10.0.3.0/24"
  availability_zone = "eu-west-2b"
  vpc_id            = aws_vpc.my_vpc.id
  tags = {
    Name                                                           = "${var.environment}-${var.name}-fargate-b"
    "kubernetes.io/role/internal-elb"                              = "1"
    "kubernetes.io/cluster/${var.environment}-${var.cluster_name}" = "owned"
  }
}

resource "aws_eip" "fargate" {
  vpc = true
  tags = {
    Name = "${var.environment}-${var.name}-fargate-nat-gateway"
  }
}

resource "aws_eip" "fargate_b" {
  vpc = true
}

resource "aws_nat_gateway" "fargate" {
  allocation_id = aws_eip.fargate.id
  subnet_id     = aws_subnet.fargate_a.id

  tags = {
    Name = "${var.environment}-${var.name}-fargate"
  }
}

resource "aws_route_table" "fargate_a" {
  vpc_id = aws_vpc.my_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.fargate.id
  }
}

resource "aws_route_table" "fargate_b" {
  vpc_id = aws_vpc.my_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.fargate.id
  }
}

resource "aws_route_table_association" "fargate_a" {
  subnet_id      = aws_subnet.fargate_a.id
  route_table_id = aws_route_table.fargate_a.id
}

resource "aws_route_table_association" "fargate_b" {
  subnet_id      = aws_subnet.fargate_b.id
  route_table_id = aws_route_table.fargate_b.id
}

