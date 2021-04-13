"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/WebRTCHub").build();
//Luoi tao sever stun :) sai cua gg cho no le
// thu 2 ghi la iceSevers nhung luoi copy them vai cai stun cua gg =)) tuong tuong nhu no co di 
// iceSevers nhin cho no xin xo vay chu de 1 cai van ngu lam
const configuration = {
   'iceServers': [{
     'urls': 'stun:stun.l.google.com:19302'
   }]
 };
const peerConn = new RTCPeerConnection(configuration);

const tenPhongTxt = document.getElementById('tenPhongTxt');
const taoPhongBtn = document.getElementById('taoPhongBtn');
const danhSachPhong = document.getElementById('danhSachPhong');
const thongBao = document.getElementById('thongBao');
const nhapFile = document.getElementById('nhapFile');
const guiFileBtn = document.getElementById('guiFileBtn');
const danhSachFile = document.getElementById('danhSachFile');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let Id;
let localStream;
let remoteStream;
let fileReader;
let isInitiator = false;
let hasRoomJoined = false;

nhapFile.disabled = true;
guiFileBtn.disabled = true;

$(danhSachPhong).DataTable({
    columns: [
        { data: 'RoomId', "width": "30%" },
        { data: 'Name', "width": "50%" },
        { data: 'Button', "width": "15%" }
    ],
    "lengthChange": false,
    "searching": false,
    "language": {
        "emptyTable": "Không có ai đang tạo phòng"
    }
});

layCamera();

connection.start().then(function () {

    connection.on('capNhatPhong', function (data) {
        var obj = JSON.parse(data);
        $(danhSachPhong).DataTable().clear().rows.add(obj).draw();
    });

    connection.on('created', function (roomId) {
        tenPhongTxt.disabled = true;
        taoPhongBtn.disabled = true;
        hasRoomJoined = true;
        thongBao.innerText = 'Bạn đã tạo phòng, đợi ai đó vô chat thôi';
        Id = roomId;
        isInitiator = true;
    });

    connection.on('joined', function (roomId) {
        Id = roomId;
        isInitiator = false;
    });

    connection.on('error', function (message) {
        alert(message);
    });

    connection.on('ready', function () {
        tenPhongTxt.disabled = true;
        taoPhongBtn.disabled = true;
        hasRoomJoined = true;
        thongBao.innerText = 'Đang kết nối';
        createPeerConnection(isInitiator, configuration);
    });

    connection.on('message', function (message) {
        signalingMessageCallback(message);
    });

    connection.on('bye', function () {
        thongBao.innerText = `Bạn của bạn đã thoát phòng`;
    });

    window.addEventListener('unload', function () {
        if (hasRoomJoined) {
            connection.invoke("LeaveRoom", Id).catch(function (err) {
                return console.error(err.toString());
            });
        }
    });
    connection.invoke("GetRoomInfo").catch(function (err) {
        return console.error(err.toString());
    });

}).catch(function (err) {
    return console.error(err.toString());
});
function sendMessage(message) {
    connection.invoke("SendMessage", Id, message).catch(function (err) {
        return console.error(err.toString());
    });
}
$(taoPhongBtn).click(function () {
    var name = tenPhongTxt.value;
    connection.invoke("CreateRoom", name).catch(function (err) {
        return console.error(err.toString());
    });
});

$('#danhSachPhong tbody').on('click', 'button', function () {
    if (hasRoomJoined) {
        alert('Bạn đã tạo phòng, mời bạn bè vào gọi đi');
    } else {
        var data = $(danhSachPhong).DataTable().row($(this).parents('tr')).data();
        connection.invoke("Join", data.RoomId).catch(function (err) {
            return console.error(err.toString());
        });
    }
});

$(nhapFile).change(function () {
    let file = nhapFile.files[0];
    if (file) {
        guiFileBtn.disabled = false;
    } else {
        guiFileBtn.disabled = true;
    }
});

$(guiFileBtn).click(function () {
    guiFileBtn.disabled = true;
    sendFile();
});
function layCamera() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    })
        .then(gotStream)
        .catch(function (e) {
            alert('getUserMedia() bị lỗi : ' + e.name);
        });
}

function gotStream(stream) {
    localStream = stream;
    peerConn.addStream(localStream);
    localVideo.srcObject = stream;
}
var dataChannel;
function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () { },
            logError);
        peerConn.createAnswer(onLocalSessionCreated, logError);

    } else if (message.type === 'answer') {
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () { },
            logError);

    } else if (message.type === 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));

    }
}

function createPeerConnection(isInitiator, config) {
    peerConn.onicecandidate = function (event) {
        if (event.candidate) {
         
        } else {
            sendMessage(peerConn.localDescription);
        }
    };

    peerConn.ontrack = function (event) {
        remoteVideo.srcObject = event.streams[0];
    };

    if (isInitiator) {
        dataChannel = peerConn.createDataChannel('sendDataChannel');
        onDataChannelCreated(dataChannel);
        peerConn.createOffer(onLocalSessionCreated, logError);
    } else {
        peerConn.ondatachannel = function (event) {
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {
    peerConn.setLocalDescription(desc, function () {
    
    }, logError);
}

function onDataChannelCreated(channel) {

    channel.onopen = function () {
        thongBao.innerText = 'Đã kết nối';
        nhapFile.disabled = false;
    };

    channel.onclose = function () {
        thongBao.innerText = 'Đóng kết nối';
    }

    channel.onmessage = onReceiveMessageCallback();
}

function onReceiveMessageCallback() {
    let count;
    let fileSize, fileName;
    let receiveBuffer = [];

    return function onmessage(event) {
        if (typeof event.data === 'string') {
            const fileMetaInfo = event.data.split(',');
            fileSize = parseInt(fileMetaInfo[0]);
            fileName = fileMetaInfo[1];
            count = 0;
            return;
        }

        receiveBuffer.push(event.data);
        count += event.data.byteLength;

        if (fileSize === count) {
            const received = new Blob(receiveBuffer);
            receiveBuffer = [];

            $(danhSachFile).children('tbody').append('<tr><td><a></a></td></tr>');
            const downloadAnchor = $(danhSachFile).find('a:last');
            downloadAnchor.attr('href', URL.createObjectURL(received));
            downloadAnchor.attr('download', fileName);
            downloadAnchor.text(`${fileName} (${fileSize} bytes)`);
        }
    };
}

function sendFile() {
    const file = nhapFile.files[0];

    if (file.size === 0) {
        alert('File rỗng gửi chi?');
        return;
    }
    dataChannel.send(file.size + ',' + file.name);
    const chunkSize = 16384;
    fileReader = new FileReader();
    let offset = 0;
    fileReader.addEventListener('error', error => console.error( error));
    fileReader.addEventListener('abort', event => console.log( event));
    fileReader.addEventListener('load', e => {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < file.size) {
            readSlice(offset);
        } else {
            alert(`${file.name} đã được gửi.`);
            guiFileBtn.disabled = false;
        }
    });
    const readSlice = o => {
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
}
function logError(err) {
    if (!err) return;
    if (typeof err === 'string') {
        console.warn(err);
    } else {
        console.warn(err.toString(), err);
    }
}