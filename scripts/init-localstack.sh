#!/bin/bash
awslocal s3 mb s3://innothoughts-vault
awslocal s3api put-bucket-acl --bucket innothoughts-vault --acl public-read
echo "LocalStack S3 bucket 'innothoughts-vault' created."
