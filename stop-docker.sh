id=`docker ps|grep playgen|cut -d' ' -f1`
echo Stopping $id
docker stop $id >/dev/null 2>&1
docker container rm $id > /dev/null 2>&1
