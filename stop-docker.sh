id=`docker ps|grep playgen|cut -d' ' -f1`
echo Stopping $id
docker stop $id >/dev/null
docker container rm $id > /dev/null
