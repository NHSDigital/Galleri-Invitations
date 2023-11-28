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

# connect gateway to subnet
resource "aws_route_table_association" "my_rta_b" {
  subnet_id      = aws_subnet.my_subnet_b.id
  route_table_id = aws_route_table.my_rt.id
}

# # create elastic ip so we can give the instance a public IP
# resource "aws_eip" "eip1" {
#   vpc                       = true
#   associate_with_private_ip = var.private_ip_1
#   depends_on = [
#     aws_internet_gateway.my_igw
#   ]
#   tags = {
#     Name = var.eip1
#   }
# }
