"use strict";

var gl;
var canvas;

// Vertex attributes
var a_PositionLoc;
var a_TexCoordLoc;

var a_NormalLoc;
var a_TangentLoc;
var a_BitangentLoc;

// Texture uniforms
var u_TextureSamplerLoc;
var u_TextureSamplerNormalLoc;

// Light uniforms
var u_LightPosLoc;
var u_LightColorLoc;
var u_kAmbientLoc;
var u_kDiffuseLoc;
var u_kSpecularLoc;
var u_shininessLoc;

// Light attributes
var lightPosition = vec4(0.0, 500.0, 0.0, 1.0);
var lightColor = vec3(1.0, 1.0, 1.0);
var kAmbient = 0.2;
var kDiffuse = 0.8;
var kSpecular = 1.0;
var shininess = 30.0;

// Radio button options uniform
var u_optionsLoc;

// Uniform matrices
var u_MvpMatrixLoc; // Modelview projection matrix
var u_MvMatrixLoc; // Modelview matrix
var u_MvMatrix_3by3Loc; // 3x3 modelview matrix

// Code-based matrices
var g_modelMatrix = mat4();
var g_viewMatrix = mat4();
var g_mvMatrix = mat4();
var g_projMatrix = mat4();
var g_mvpMatrix = mat4();

var g_mvMatrix_3by3 = mat3();

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.enable(gl.DEPTH_TEST);


    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Assign all attribute and uniform locations from shaders
    a_PositionLoc = gl.getAttribLocation(program, "a_Position");
    a_NormalLoc = gl.getAttribLocation(program, "a_Normal");
    a_TangentLoc = gl.getAttribLocation(program, "a_Tangent");
    a_BitangentLoc = gl.getAttribLocation(program, "a_Bitangent");
    a_TexCoordLoc = gl.getAttribLocation(program, "a_TexCoord");

    u_TextureSamplerLoc = gl.getUniformLocation(program, "u_TextureSampler");
    u_TextureSamplerNormalLoc = gl.getUniformLocation(program, "u_TextureSamplerNormal");

    u_LightPosLoc = gl.getUniformLocation(program, "u_LightPos");
    u_LightColorLoc = gl.getUniformLocation(program, "u_LightColor");
    u_kAmbientLoc = gl.getUniformLocation(program, "u_kAmbient");
    u_kDiffuseLoc = gl.getUniformLocation(program, "u_kDiffuse");
    u_kSpecularLoc = gl.getUniformLocation(program, "u_kSpecular");
    u_shininessLoc = gl.getUniformLocation(program, "u_shininess");
        // Send in light attributes
    gl.uniform4fv(u_LightPosLoc, lightPosition);
    gl.uniform3fv(u_LightColorLoc, lightColor);
    gl.uniform1f(u_kAmbientLoc, kAmbient);
    gl.uniform1f(u_kDiffuseLoc, kDiffuse);
    gl.uniform1f(u_kSpecularLoc, kSpecular);
    gl.uniform1f(u_shininessLoc, shininess);

    u_optionsLoc = gl.getUniformLocation(program, "u_options");
    gl.uniform1i(u_optionsLoc, 3); // Set startup option

    u_MvpMatrixLoc = gl.getUniformLocation(program, "u_MvpMatrix");
    u_MvMatrixLoc = gl.getUniformLocation(program, "u_MvMatrix");
    u_MvMatrix_3by3Loc = gl.getUniformLocation(program, "u_MvMatrix_3by3");

    if (
        a_PositionLoc < 0
        ||  a_NormalLoc < 0
        ||  a_TangentLoc < 0
        ||  a_BitangentLoc < 0
        || a_TexCoordLoc < 0
        || !u_TextureSamplerLoc
        || !u_TextureSamplerNormalLoc
        || !u_MvpMatrixLoc
        || !u_MvMatrixLoc
        || !u_MvMatrix_3by3Loc
        ) {
        console.log('Failed to get the location of attribute and uniform variables');
        return;
    }

    // Prepare empty buffer objects for vertex coordinates, colors, and normals
    var model = initVertexBuffers(gl);
    if (!model) {
        console.log('Failed to set the vertex information');
        return;
    }

    // calculate viewing and projection matrix
    g_viewMatrix = lookAt(vec3(0.0, 400.0, 200.0),
                            vec3(0.0, 0.0, 0.0),
                            vec3(0.0, 1.0, 0.0));
    g_projMatrix = perspective(30.0, canvas.width/canvas.height, 1.0, 5000.0);

    // Start reading the OBJ file
    readOBJFile('Orange.obj', gl, model, 100, true);

    initTextures(gl);

    var currentAngle = 0.0; // Current rotation angle [degree]
    var tick = function() {   // Start drawing
        currentAngle = animate(currentAngle); // Update current rotation angle
        draw(gl, currentAngle, model);
        requestAnimationFrame(tick, canvas);
    };
    tick();

};

// Radio button functionality
function buttonChanged(element) {
    if(element.id == "texture")
        gl.uniform1i(u_optionsLoc, 1);
    if(element.id == "lighting")
        gl.uniform1i(u_optionsLoc, 2);
    if(element.id == "normal")
        gl.uniform1i(u_optionsLoc, 3);
}

// Create an buffer object and perform an initial configuration
function initVertexBuffers(gl) {
    var o = new Object(); // Utilize Object object to return multiple buffer objects
    o.vertexBuffer = createEmptyArrayBuffer(gl, a_PositionLoc, 3, gl.FLOAT);
    o.normalBuffer = createEmptyArrayBuffer(gl, a_NormalLoc, 3, gl.FLOAT);
    o.tangentBuffer = createEmptyArrayBuffer(gl, a_TangentLoc, 3, gl.FLOAT);
    o.bitangentBuffer = createEmptyArrayBuffer(gl, a_BitangentLoc, 3, gl.FLOAT);
    o.textureBuffer = createEmptyArrayBuffer(gl, a_TexCoordLoc, 2, gl.FLOAT);
    o.indexBuffer = gl.createBuffer();
    if (!o.vertexBuffer
        || !o.normalBuffer
        || !o.tangentBuffer
        || !o.bitangentBuffer
        || !o.textureBuffer
        || !o.indexBuffer)
        { return null; }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return o;
}

// Create a buffer object, assign it to attribute variables, and enable the assignment
function createEmptyArrayBuffer(gl, a_attribute, num, type) {
    var buffer =  gl.createBuffer();  // Create a buffer object
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);  // Assign the buffer object to the attribute variable
    gl.enableVertexAttribArray(a_attribute);  // Enable the assignment

    return buffer;
}

function initTextures(gl) {
    var colorTexture = gl.createTexture();   // Create a texture object
    if (!colorTexture) {
        console.log('Failed to create the color texture object');
        return false;
    }
    var colorImage = new Image();  // Create the image object
    if (!colorImage) {
        console.log('Failed to create the color image object');
        return false;
    }
    // Register the event handler to be called on loading an image
    colorImage.onload = function(){ loadTexture(gl, colorTexture, u_TextureSamplerLoc, colorImage, 0); };
    colorImage.src = 'Color.jpg';

    var normalTexture = gl.createTexture();   // Create a texture object
    if (!normalTexture) {
        console.log('Failed to create the normal texture object');
        return false;
    }
    var normalImage = new Image();  // Create the image object
    if (!normalImage) {
        console.log('Failed to create the normal image object');
        return false;
    }
    // Register the event handler to be called on loading an image
    normalImage.onload = function(){ loadTexture(gl, normalTexture, u_TextureSamplerNormalLoc, normalImage, 1); };
    normalImage.src = 'Normal.jpg';

    return true;
}

function loadTexture(gl, texture, sampler, image, id) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
    if (id==0)
        // Enable texture unit0
        gl.activeTexture(gl.TEXTURE0);
    else if (id==1)
        // Enable texture unit1
        gl.activeTexture(gl.TEXTURE1);
    // Bind the texture object to the target
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Set the texture image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

    // Set the texture unit to the sampler
    gl.uniform1i(sampler, id);
}

// Read a file
function readOBJFile(fileName, gl, model, scale, reverse) {
    var request = new XMLHttpRequest();

    request.onreadystatechange = function() {
        if (request.readyState === 4 && request.status !== 404) {
            onReadOBJFile(request.responseText, fileName, gl, model, scale, reverse);
        }
    }
    request.open('GET', fileName, true); // Create a request to acquire the file
    request.send();                      // Send the request
}

var g_objDoc = null;      // The information of OBJ file
var g_drawingInfo = null; // The information for drawing 3D model

// OBJ File has been read
function onReadOBJFile(fileString, fileName, gl, o, scale, reverse) {
    var objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    var result = objDoc.parse(fileString, scale, reverse); // Parse the file
    if (!result) {
        g_objDoc = null; g_drawingInfo = null;
        console.log("OBJ file parsing error.");
        return;
    }
    g_objDoc = objDoc;
}

// Drawing function
function draw(gl, angle, model) {
    if (g_objDoc != null){ // OBJ and all MTLs are available
        g_drawingInfo = onReadComplete(gl, model, g_objDoc);
        g_objDoc = null;
    }
    if (!g_drawingInfo) return;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Clear color and depth buffers

    g_modelMatrix = mult(rotateX(angle), mult(rotateY(angle), rotateZ(angle)));

    // Calculate the 4 by 4 model view matrix and pass it to u_MvMatrix
    g_mvMatrix = mult(g_viewMatrix, g_modelMatrix);
    gl.uniformMatrix4fv(u_MvMatrixLoc, false, flatten(g_mvMatrix));

    // Calculate the 3 by 3 model view matrix and pass it to u_MvMatrix_3by3
    // use this 3by3 matrix to transform normal, tangent, bi-tangent vectors
    // from object space to eye space to create the TBN frame
    // assume non-uniform scaling (otherwise we need to use normal matrix)
    g_mvMatrix_3by3 = matrix4by4to3by3(g_mvMatrix);
    gl.uniformMatrix3fv(u_MvMatrix_3by3Loc, false, flatten(g_mvMatrix_3by3));

    // Calculate the model view project matrix and pass it to u_MvpMatrix
    g_mvpMatrix = mult(g_projMatrix, g_mvMatrix);
    gl.uniformMatrix4fv(u_MvpMatrixLoc, false, flatten(g_mvpMatrix));

    // Draw
    gl.drawElements(gl.TRIANGLES, g_drawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
}

// OBJ File has been read completely
function onReadComplete(gl, model, objDoc) {
    // Acquire the vertex coordinates and colors from OBJ file
    var drawingInfo = objDoc.getDrawingInfo();

    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.tangentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.tangents, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.bitangentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.bitangents, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.textures, gl.STATIC_DRAW);

    // Write the indices to the buffer object
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawingInfo.indices, gl.STATIC_DRAW);

    return drawingInfo;
}

var ANGLE_STEP = 5;   // The increments of rotation angle (degrees)

var last = Date.now(); // Last time that this function was called
function animate(angle) {
    var now = Date.now();   // Calculate the elapsed time
    var elapsed = now - last;
    last = now;
    // Update the current rotation angle (adjusted by the elapsed time)
    var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
    return newAngle % 360;
}
