//------------------------------------------------------------------------------
// OBJParser
//------------------------------------------------------------------------------

// OBJDoc object
// Constructor
var OBJDoc = function(fileName) {
    this.fileName = fileName;
    this.objects = new Array(0);   // Initialize the property for Object
    this.vertices = new Array(0);  // Initialize the property for Vertex
    this.normals = new Array(0);   // Initialize the property for Normal
    this.textures = new Array(0);  // Initialize the property for Texture
}

// Parsing the OBJ file
// fileString is the content of the entire obj file
// scale is the scaling factor for vertices
// reverse indicates whether the normal should be reversed or not
OBJDoc.prototype.parse = function(fileString, scale, reverse) {
    var lines = fileString.split('\n');  // Break up into lines and store them as array
    lines.push(null); // Append null, make it easy to find the end of the array
    var index = 0;    // Initialize index of line
    
    var currentObject = null;
    var currentMaterialName = "";
    
    // Parse line by line
    var line;         // A string in the line to be parsed
    var sp = new StringParser();  // Create StringParser
    while ((line = lines[index++]) != null) {
        sp.init(line);                  // init StringParser
        var command = sp.getWord();     // Get command
        if(command == null)	 continue;  // check null command
        
        switch(command){
            case '#':
                continue;  // Skip comments
            case 'o':
            case 'g':   // Read Object name
                var object = this.parseObjectName(sp);
                this.objects.push(object);
                currentObject = object;
                continue; // Go to the next line
            case 'v':   // Read vertex
                var vertex = this.parseVertex(sp, scale);
                this.vertices.push(vertex);
                
                // special handling for spherical normals
                var normal = new Normal(vertex.x, vertex.y, vertex.z);
                var nNormal = normalizeVector(normal.x, normal.y, normal.z);
                this.normals.push(new Normal(nNormal[0], nNormal[1], nNormal[2]));
                
                continue; // Go to the next line
            case 'vn':   // Read normal
                var normal = this.parseNormal(sp);
                this.normals.push(normal);
                continue; // Go to the next line
            case 'vt':   // Read texture
                var texture = this.parseTexture(sp);
                this.textures.push(texture);
                continue; // Go to the next line
            case 'f': // Read face
                var face = this.parseFace(sp, currentMaterialName, this.vertices, reverse);
                currentObject.addFace(face);
                continue; // Go to the next line
        }
    }
    
    return true;
}

OBJDoc.prototype.parseObjectName = function(sp) {
    var name = sp.getWord();
    return (new OBJObject(name));
}

OBJDoc.prototype.parseVertex = function(sp, scale) {
    var x = sp.getFloat() * scale;
    var y = sp.getFloat() * scale;
    var z = sp.getFloat() * scale;
    return (new Vertex(x, y, z));
}

OBJDoc.prototype.parseNormal = function(sp) {
    var x = sp.getFloat();
    var y = sp.getFloat();
    var z = sp.getFloat();
    return (new Normal(x, y, z));
}

OBJDoc.prototype.parseTexture = function(sp) {
    var x = sp.getFloat();
    var y = sp.getFloat();
    return (new Texture(x, y));
}

OBJDoc.prototype.parseFace = function(sp, materialName, vertices, reverse) {
    var face = new Face(materialName);
    // get indices
    for(;;){
        var word = sp.getWord();
        if(word == null) break;
        var subWords = word.split('/');
        if(subWords.length >= 1){
            // vertex index
            var vi = parseInt(subWords[0]) - 1;
            face.vIndices.push(vi);
            
            // special handling for spherical normals
            face.nIndices.push(vi);
            
        }
        if(subWords.length >= 2){
            // texture index
            var ti = parseInt(subWords[1]) - 1;
            face.tIndices.push(ti);
        }
        if(subWords.length >= 3){
            // normal index
            var ni = parseInt(subWords[2]) - 1;
            face.nIndices.push(ni);
        }
        // omit this (special handling for spherical normals)
        /*
        else{
            face.nIndices.push(-1);
        }
        */
    }
    
    // calc normal
    var v0 = [
              vertices[face.vIndices[0]].x,
              vertices[face.vIndices[0]].y,
              vertices[face.vIndices[0]].z];
    var v1 = [
              vertices[face.vIndices[1]].x,
              vertices[face.vIndices[1]].y,
              vertices[face.vIndices[1]].z];
    var v2 = [
              vertices[face.vIndices[2]].x,
              vertices[face.vIndices[2]].y,
              vertices[face.vIndices[2]].z];
    
    // calculate the normal of the surface
    var normal = calcNormal(v0, v1, v2);
    // examine whether the normal has been determined correctly
    if (normal == null) {
        if (face.vIndices.length >= 4) { // normal calculation by the combination of another three points if the face is square
            var v3 = [
                      vertices[face.vIndices[3]].x,
                      vertices[face.vIndices[3]].y,
                      vertices[face.vIndices[3]].z];
            normal = calcNormal(v1, v2, v3);
        }
        if(normal == null){ // set the normal to the Y-axis direction if not determined
            normal = [0.0, 1.0, 0.0];
        }
    }
    if(reverse){
        normal[0] = -normal[0];
        normal[1] = -normal[1];
        normal[2] = -normal[2];
    }
    face.normal = new Normal(normal[0], normal[1], normal[2]);
    
    // Devide to triangles if face contains over three points
    if(face.vIndices.length > 3){
        var n = face.vIndices.length - 2;
        var newVIndices = new Array(n * 3);
        var newTIndices = new Array(n * 3);
        var newNIndices = new Array(n * 3);
        for(var i=0; i<n; i++){
            newVIndices[i * 3 + 0] = face.vIndices[0];
            newVIndices[i * 3 + 1] = face.vIndices[i + 1];
            newVIndices[i * 3 + 2] = face.vIndices[i + 2];
            newTIndices[i * 3 + 0] = face.tIndices[0];
            newTIndices[i * 3 + 1] = face.tIndices[i + 1];
            newTIndices[i * 3 + 2] = face.tIndices[i + 2];
            newNIndices[i * 3 + 0] = face.nIndices[0];
            newNIndices[i * 3 + 1] = face.nIndices[i + 1];
            newNIndices[i * 3 + 2] = face.nIndices[i + 2];
        }
        face.vIndices = newVIndices;
        face.tIndices = newTIndices;
        face.nIndices = newNIndices;
    }
    face.numIndices = face.vIndices.length;
    
    return face;
}

//------------------------------------------------------------------------------
// Retrieve the information for drawing 3D model
OBJDoc.prototype.getDrawingInfo = function() {
    // Create an arrays for vertex coordinates, normals, tangents, bitagents, textures, and indices
    var numIndices = 0;
    for(var i = 0; i < this.objects.length; i++){
        numIndices += this.objects[i].numIndices;
    }
    var numVertices = numIndices;

    var vertices = new Float32Array(numVertices * 3);
    var normals = new Float32Array(numVertices * 3);
    var tangents = new Float32Array(numVertices * 3);
    var bitangents = new Float32Array(numVertices * 3);
    var textures = new Float32Array(numVertices * 2);
    var indices = new Uint16Array(numIndices);
    
    // Set vertex, normal, texture and color
    var index_indices = 0;
    for(var i = 0; i < this.objects.length; i++){
        var object = this.objects[i];
        for(var j = 0; j < object.faces.length; j++){
            var face = object.faces[j];
            var faceNormal = face.normal;
            //console.log(face.vIndices.length); // either 6 (2 triangles) or 3 (1 triangle)
            var vCount = 0;
            for(var k = 0; k < face.vIndices.length; k++){
                // Set index
                indices[index_indices] = index_indices;
                // Copy vertex
                var vIdx = face.vIndices[k];
                var vertex = this.vertices[vIdx];
                vertices[index_indices * 3 + 0] = vertex.x;
                vertices[index_indices * 3 + 1] = vertex.y;
                vertices[index_indices * 3 + 2] = vertex.z;
                // Copy texture
                var tIdx = face.tIndices[k];
                var texture = this.textures[tIdx];
                textures[index_indices * 2 + 0] = texture.x;
                textures[index_indices * 2 + 1] = texture.y;
                // Copy normal
                var nIdx = face.nIndices[k];
                if(nIdx >= 0){
                    var normal = this.normals[nIdx];
                    normals[index_indices * 3 + 0] = normal.x;
                    normals[index_indices * 3 + 1] = normal.y;
                    normals[index_indices * 3 + 2] = normal.z;
                }else{
                    normals[index_indices * 3 + 0] = faceNormal.x;
                    normals[index_indices * 3 + 1] = faceNormal.y;
                    normals[index_indices * 3 + 2] = faceNormal.z;
                }
                index_indices ++;
                
                vCount++;
                if (vCount==3) {
                    // get the tangent and bitangent vectors based on the triangle
                    var v0 = [vertices[(index_indices-3) * 3 + 0],
                              vertices[(index_indices-3) * 3 + 1],
                              vertices[(index_indices-3) * 3 + 2]];
                    var v1 = [vertices[(index_indices-2) * 3 + 0],
                              vertices[(index_indices-2) * 3 + 1],
                              vertices[(index_indices-2) * 3 + 2]];
                    var v2 = [vertices[(index_indices-1) * 3 + 0],
                              vertices[(index_indices-1) * 3 + 1],
                              vertices[(index_indices-1) * 3 + 2]];
                    var uv0 = [textures[(index_indices-3) * 2 + 0],
                               textures[(index_indices-3) * 2 + 1]];
                    var uv1 = [textures[(index_indices-2) * 2 + 0],
                               textures[(index_indices-2) * 2 + 1]];
                    var uv2 = [textures[(index_indices-1) * 2 + 0],
                               textures[(index_indices-1) * 2 + 1]];
                    
                    //console.log(v0, v1, v2, uv0, uv1, uv2);
                    
                    // Edges of the triangle : postion delta
                    var deltaPos1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
                    var deltaPos2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
                    
                    //console.log(deltaPos1);
                    
                    // UV delta
                    var deltaUV1 = [uv1[0]-uv0[0], uv1[1]-uv0[1]];
                    var deltaUV2 = [uv2[0]-uv0[0], uv2[1]-uv0[1]];

                    var r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);
                    var tangent = [(deltaPos1[0] * deltaUV2[1] - deltaPos2[0] * deltaUV1[1])*r,
                                   (deltaPos1[1] * deltaUV2[1] - deltaPos2[1] * deltaUV1[1])*r,
                                   (deltaPos1[2] * deltaUV2[1] - deltaPos2[2] * deltaUV1[1])*r];
                    var bitangent = [(deltaPos2[0] * deltaUV1[0] - deltaPos1[0] * deltaUV2[0])*r,
                                     (deltaPos2[1] * deltaUV1[0] - deltaPos1[1] * deltaUV2[0])*r,
                                     (deltaPos2[2] * deltaUV1[0] - deltaPos1[2] * deltaUV2[0])*r];
                    //console.log(tangent, bitangent);
                    
                    var nTangent = normalizeVector(tangent[0], tangent[1], tangent[2]);
                    tangent[0] = nTangent[0];
                    tangent[1] = nTangent[1];
                    tangent[2] = nTangent[2];
                    //console.log(tangent);
                    
                    var nBitangent = normalizeVector(bitangent[0], bitangent[1], bitangent[2]);
                    bitangent[0] = nBitangent[0];
                    bitangent[1] = nBitangent[1];
                    bitangent[2] = nBitangent[2];
                    //console.log(bitangent);
                    
                    // Set the same tangent for all three vertices of the triangle
                    tangents[(index_indices-3) * 3 + 0] = tangent[0];
                    tangents[(index_indices-3) * 3 + 1] = tangent[1];
                    tangents[(index_indices-3) * 3 + 2] = tangent[2];
                    tangents[(index_indices-2) * 3 + 0] = tangent[0];
                    tangents[(index_indices-2) * 3 + 1] = tangent[1];
                    tangents[(index_indices-2) * 3 + 2] = tangent[2];
                    tangents[(index_indices-1) * 3 + 0] = tangent[0];
                    tangents[(index_indices-1) * 3 + 1] = tangent[1];
                    tangents[(index_indices-1) * 3 + 2] = tangent[2];
                    
                    // Same thing for bitangent
                    bitangents[(index_indices-3) * 3 + 0] = bitangent[0];
                    bitangents[(index_indices-3) * 3 + 1] = bitangent[1];
                    bitangents[(index_indices-3) * 3 + 2] = bitangent[2];
                    bitangents[(index_indices-2) * 3 + 0] = bitangent[0];
                    bitangents[(index_indices-2) * 3 + 1] = bitangent[1];
                    bitangents[(index_indices-2) * 3 + 2] = bitangent[2];
                    bitangents[(index_indices-1) * 3 + 0] = bitangent[0];
                    bitangents[(index_indices-1) * 3 + 1] = bitangent[1];
                    bitangents[(index_indices-1) * 3 + 2] = bitangent[2];
                    
                    vCount = 0;
                }
            }
        }
    }
///*
    // for the same vertex, average the tangent and bitangent vectors
    var flag = new Uint8Array(numIndices);
    var tangentX, tangentY, tangentZ;
    var bitangentX, bitangentY, bitangentZ;
    
    for (var i=0; i<numVertices; i++) flag[i] = 0;
    for (var i=0; i<numVertices; i++){
        if (flag[i]==0) {
            var ids = [];
            ids.push(i);
            tangentX = tangents[i*3+0];
            tangentY = tangents[i*3+1];
            tangentZ = tangents[i*3+2];
            bitangentX = bitangents[i*3+0];
            bitangentY = bitangents[i*3+1];
            bitangentZ = bitangents[i*3+2];
            for (var j=i+1; j<numVertices; j++){
                // both vertices have the same position, normal, and texture
                if ((flag[j]==0) &&
                    (vertices[i*3+0]==vertices[j*3+0]) &&
                    (vertices[i*3+1]==vertices[j*3+1]) &&
                    (vertices[i*3+2]==vertices[j*3+2]) &&
                    (normals[i*3+0]==normals[j*3+0]) &&
                    (normals[i*3+1]==normals[j*3+1]) &&
                    (normals[i*3+2]==normals[j*3+2]) &&
                    (textures[i*2+0]==textures[j*2+0]) &&
                    (textures[i*2+1]==textures[j*2+1]))
                {
                    ids.push(j);
                    tangentX += tangents[j*3+0];
                    tangentY += tangents[j*3+1];
                    tangentZ += tangents[j*3+2];
                    bitangentX += bitangents[j*3+0];
                    bitangentY += bitangents[j*3+1];
                    bitangentZ += bitangents[j*3+2];
                }
            }
            var nTangent = normalizeVector(tangentX, tangentY, tangentZ);
            tangentX = nTangent[0];
            tangentY = nTangent[1];
            tangentZ = nTangent[2];
            var nBitangent = normalizeVector(bitangentX, bitangentY, bitangentZ);
            bitangentX = nBitangent[0];
            bitangentY = nBitangent[1];
            bitangentZ = nBitangent[2];
            //console.log(tangentX, tangentY, tangentZ, bitangentX, bitangentY, bitangentZ);
        
            var count = ids.length;
            //console.log(count);
            for (var k=0; k<count; k++){
                flag[ids[k]] = 1;
                tangents[ids[k]*3+0] = tangentX;
                tangents[ids[k]*3+1] = tangentY;
                tangents[ids[k]*3+2] = tangentZ;
                bitangents[ids[k]*3+0] = bitangentX;
                bitangents[ids[k]*3+1] = bitangentY;
                bitangents[ids[k]*3+2] = bitangentZ;
            }
            ids = null;
        }
    }
//*/
    //console.log(index_indices);
    return new DrawingInfo(vertices, normals, tangents, bitangents, textures, indices);
}

//------------------------------------------------------------------------------
// Vertex Object
//------------------------------------------------------------------------------
var Vertex = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
}

//------------------------------------------------------------------------------
// Normal Object
//------------------------------------------------------------------------------
var Normal = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
}

//------------------------------------------------------------------------------
// Color Object
//------------------------------------------------------------------------------
var Color = function(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
}

//------------------------------------------------------------------------------
// Texture Object
//------------------------------------------------------------------------------
var Texture = function(x, y) {
    this.x = x;
    this.y = y;
}

//------------------------------------------------------------------------------
// OBJObject Object
//------------------------------------------------------------------------------
var OBJObject = function(name) {
    this.name = name;
    this.faces = new Array(0);
    this.numIndices = 0;
}

OBJObject.prototype.addFace = function(face) {
    this.faces.push(face);
    this.numIndices += face.numIndices;
}

//------------------------------------------------------------------------------
// Face Object
//------------------------------------------------------------------------------
var Face = function(materialName) {
    this.materialName = materialName;
    if(materialName == null)  this.materialName = "";
    this.vIndices = new Array(0);
    this.nIndices = new Array(0);
    this.tIndices = new Array(0);
}

//------------------------------------------------------------------------------
// DrawInfo Object
//------------------------------------------------------------------------------
var DrawingInfo = function(vertices, normals, tangents, bitangents, textures, indices) {
    this.vertices = vertices;
    this.normals = normals;
    this.tangents = tangents;
    this.bitangents = bitangents;
    this.textures = textures;
    this.indices = indices;
}

//------------------------------------------------------------------------------
// Constructor
// The constructor is a special method that is called when creating an object with "new"
var StringParser = function(str) {
    // "str" and "index" are the names of declared properties
    this.str;   // Store the string specified by the argument
    this.index; // Position in the string to be processed
    this.init(str);
}
// Initialize StringParser object
StringParser.prototype.init = function(str){
    // you can access the property defined in the constructor from the method
    this.str = str;
    this.index = 0;
}

// Skip delimiters
StringParser.prototype.skipDelimiters = function()  {
    for(var i = this.index, len = this.str.length; i < len; i++){
        var c = this.str.charAt(i);
        // Skip TAB, Space, '(', ')
        if (c == '\t'|| c == ' ' || c == '(' || c == ')' || c == '"') continue;
        break;
    }
    this.index = i;
}

// Skip to the next word
StringParser.prototype.skipToNextWord = function() {
    this.skipDelimiters();
    var n = getWordLength(this.str, this.index);
    this.index += (n + 1);
}

// Get word
StringParser.prototype.getWord = function() {
    this.skipDelimiters();
    var n = getWordLength(this.str, this.index);
    if (n == 0) return null;
    var word = this.str.substr(this.index, n);
    this.index += (n + 1);
    
    return word;
}

// Get integer
StringParser.prototype.getInt = function() {
    return parseInt(this.getWord());
}

// Get floating number
StringParser.prototype.getFloat = function() {
    return parseFloat(this.getWord());
}

// Get the length of word
function getWordLength(str, start) {
    var n = 0;
    for(var i = start, len = str.length; i < len; i++){
        var c = str.charAt(i);
        if (c == '\t'|| c == ' ' || c == '(' || c == ')' || c == '"') 
            break;
    }
    return i - start;
}

//------------------------------------------------------------------------------
// Common function
//------------------------------------------------------------------------------

function normalizeVector(x, y, z) {
    var c = new Float32Array(3);
    c[0] = x; c[1] = y; c[2] = z;
    var g = Math.sqrt(c[0]*c[0] + c[1]*c[1] + c[2]*c[2]);
    if(g){
        if(g == 1)
            return c;
    } else {
        c[0] = 0; c[1] = 0; c[2] = 0;
        return c;
    }
    g = 1/g;
    c[0] *= g; c[1] *= g; c[2] *= g;
    return c;
}

function calcNormal(p0, p1, p2) {
    // v0: a vector from p1 to p0, v1; a vector from p1 to p2
    var v0 = new Float32Array(3);
    var v1 = new Float32Array(3);
    for (var i = 0; i < 3; i++){
        v0[i] = p0[i] - p1[i];
        v1[i] = p2[i] - p1[i];
    }
    
    // The cross product of v0 and v1
    var c = new Float32Array(3);
    c[0] = v0[1] * v1[2] - v0[2] * v1[1];
    c[1] = v0[2] * v1[0] - v0[0] * v1[2];
    c[2] = v0[0] * v1[1] - v0[1] * v1[0];
    
    // Normalize the result
/*
    var v = new Vector3(c);
    v.normalize();
    return v.elements;
*/
    return normalizeVector(c[0], c[1], c[2]);
}
