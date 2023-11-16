output "vpc_id" {
  value = aws_vpc.my_vpc.id
}

output "subnet_ids" {
  value = [aws_subnet.my_subnet_a.id, aws_subnet.my_subnet_b.id]
}
