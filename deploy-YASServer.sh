#!/bin/bash

IMAGE_NAME=ib/yas-server
CONTAINER_NAME=yas-server

echo "== build :: $IMAGE_NAME"
cd ./YASServerDocker

echo ".. remove container :: $CONTAINER_NAME"
sudo docker stop $CONTAINER_NAME
sudo docker rm $CONTAINER_NAME

echo '.. remove image'
sudo docker image rm $IMAGE_NAME

echo '.. build image'
sudo docker build -t $IMAGE_NAME .
sudo docker images $IMAGE_NAME

echo ".. run container :: $CONTAINER_NAME"
sudo docker run -d -p 3000:3000/tcp --name $CONTAINER_NAME --link flat-mongo:mongo $IMAGE_NAME

cd ..
echo 'done.'
